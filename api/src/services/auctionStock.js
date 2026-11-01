import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Order from "../models/Order.js";

export async function processAuctionStock(id, now, onTransition) {
  const session = await mongoose.startSession();
  try {
    let event = null;
    await session.withTransaction(async () => {
      event = null;
      const auction = await Auction.findById(id).session(session).lean();
      if (!auction || !["pendente", "reservada"].includes(auction.reservaStock))
        return;
      const time = now ?? Date.now();
      const filter = {
        _id: auction._id,
        estado: auction.estado,
        reservaStock: auction.reservaStock,
      };
      async function transition(values) {
        const result = await Auction.updateOne(
          filter,
          { $set: values },
          { session, runValidators: true },
        );
        return result.modifiedCount === 1;
      }

      if (
        new Date(auction.dataFim).getTime() <= time ||
        auction.estado === "terminado"
      ) {
        const reserved = auction.reservaStock === "reservada";
        const winner = Boolean(auction.licitacaoAtual.compradorId);
        if (
          !(await transition({
            estado: "terminado",
            reservaStock: reserved
              ? winner
                ? "atribuida"
                : "libertada"
              : "sem-reserva",
          }))
        )
          return;
        let orderId = null;
        if (reserved && winner) {
          const products = await Product.find({
            _id: { $in: auction.produtos.map((line) => line.produtoId) },
          })
            .session(session)
            .lean();
          const byId = new Map(
            products.map((product) => [String(product._id), product]),
          );
          if (products.length !== auction.produtos.length)
            throw new Error("Um produto do lote deixou de estar disponível.");
          const lines = auction.produtos.map((line) => ({
            produtoId: line.produtoId,
            nome: byId.get(String(line.produtoId)).nome,
            quantidade: line.quantidade,
            unidade: line.unidade,
          }));
          const [order] = await Order.create(
            [
              {
                compradorId: auction.licitacaoAtual.compradorId,
                produtorId: auction.produtorId,
                linhas: lines,
                total: auction.licitacaoAtual.valor,
                estado: "pendente",
                leilaoId: auction._id,
              },
            ],
            { session, ordered: true },
          );
          orderId = String(order._id);
        }
        if (reserved && !winner) {
          for (const line of auction.produtos) {
            const result = await Product.updateOne(
              { _id: line.produtoId },
              { $inc: { stock: line.quantidade } },
              { session },
            );
            if (result.matchedCount !== 1)
              throw new Error(
                "Não foi possível devolver o stock de um produto reservado.",
              );
          }
        }
        event = {
          id: String(auction._id),
          estado: "terminado",
          produtorId: String(auction.produtorId),
          vencedorId: winner
            ? String(auction.licitacaoAtual.compradorId)
            : null,
          valor: auction.licitacaoAtual.valor,
          orderId,
        };
        return;
      }
      if (
        auction.estado !== "agendado" ||
        auction.reservaStock !== "pendente" ||
        new Date(auction.dataInicio).getTime() > time
      )
        return;

      const producer = await User.findOne({
        _id: auction.produtorId,
        papel: "produtor",
        "perfilProdutor.validacao": "aceite",
      }).session(session);
      const products = await Product.find({
        _id: { $in: auction.produtos.map((line) => line.produtoId) },
      })
        .select("+bloqueado")
        .session(session)
        .lean();
      if (new Date(auction.dataFim).getTime() <= (now ?? Date.now())) {
        await transition({ estado: "terminado", reservaStock: "sem-reserva" });
        return;
      }
      const byId = new Map(
        products.map((product) => [String(product._id), product]),
      );
      let reason;
      if (!producer) reason = "produtor-indisponivel";
      else if (
        auction.produtos.some((line) => {
          const product = byId.get(String(line.produtoId));
          return (
            !product ||
            !product.publicado ||
            product.bloqueado ||
            String(product.produtorId) !== String(auction.produtorId) ||
            product.unidade !== line.unidade
          );
        })
      )
        reason = "produto-indisponivel";
      else if (
        auction.produtos.some(
          (line) => byId.get(String(line.produtoId)).stock < line.quantidade,
        )
      )
        reason = "stock-insuficiente";

      if (reason) {
        if (
          await transition({
            estado: "cancelado",
            reservaStock: "sem-reserva",
            motivoCancelamento: reason,
          })
        ) {
          event = {
            id: String(auction._id),
            estado: "cancelado",
            motivo: reason,
            produtorId: String(auction.produtorId),
          };
        }
        return;
      }
      if (!(await transition({ estado: "ativo", reservaStock: "reservada" })))
        return;
      for (const line of auction.produtos) {
        const result = await Product.updateOne(
          {
            _id: line.produtoId,
            produtorId: auction.produtorId,
            publicado: true,
            bloqueado: { $ne: true },
            unidade: line.unidade,
            stock: { $gte: line.quantidade },
          },
          { $inc: { stock: -line.quantidade } },
          { session },
        );
        if (result.modifiedCount !== 1)
          throw new Error("Não foi possível reservar o stock do lote.");
      }
      event = { id: String(auction._id), estado: "ativo" };
    });
    if (event) onTransition?.(event);
    return event;
  } finally {
    await session.endSession();
  }
}

export async function processAuctionsStock(now, onTransition) {
  const date = new Date(now ?? Date.now());
  const endings = await Auction.find({
    reservaStock: { $in: ["pendente", "reservada"] },
    $or: [{ dataFim: { $lte: date } }, { estado: "terminado" }],
  })
    .sort({ dataFim: 1, _id: 1 })
    .select("_id")
    .lean();
  const starts = await Auction.find({
    estado: "agendado",
    reservaStock: "pendente",
    dataInicio: { $lte: date },
    dataFim: { $gt: date },
  })
    .sort({ dataInicio: 1, _id: 1 })
    .select("_id")
    .lean();
  const errors = [];
  for (const auction of [...endings, ...starts]) {
    try {
      await processAuctionStock(auction._id, now, onTransition);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length)
    throw new AggregateError(
      errors,
      "Um ou mais leilões não puderam ser processados; serão tentados no próximo ciclo.",
    );
}

// Recursive scheduling prevents overlapping cycles, including slow database calls.
export function scheduleAuctionsStock(
  onError = (error) =>
    console.error("Falha no processamento dos leilões:", error.name),
  onTransition,
) {
  let stopped = false;
  let timer;
  const schedule = () => {
    timer = setTimeout(async () => {
      try {
        await processAuctionsStock(undefined, onTransition);
      } catch (error) {
        onError(error);
      }
      if (!stopped) schedule();
    }, 5000);
    timer.unref();
  };
  schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
