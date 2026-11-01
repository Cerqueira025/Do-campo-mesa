import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

export async function processAuctionStock(id, now) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
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
        await transition({
          estado: "cancelado",
          reservaStock: "sem-reserva",
          motivoCancelamento: reason,
        });
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
            unidade: line.unidade,
            stock: { $gte: line.quantidade },
          },
          { $inc: { stock: -line.quantidade } },
          { session },
        );
        if (result.modifiedCount !== 1)
          throw new Error("Não foi possível reservar o stock do lote.");
      }
    });
  } finally {
    await session.endSession();
  }
}

export async function processAuctionsStock(now) {
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
      await processAuctionStock(auction._id, now);
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
) {
  let stopped = false;
  let timer;
  const schedule = () => {
    timer = setTimeout(async () => {
      try {
        await processAuctionsStock();
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
