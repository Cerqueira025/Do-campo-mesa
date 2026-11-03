import { Router } from "express";
import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { requireApprovedProducer, requireAuth } from "../middleware/auth.js";
import { requireObjectBody } from "../middleware/requestBody.js";
import { auctionStateFilter } from "../domain/auction.js";
import { validPurchaseQuantity } from "../domain/purchaseQuantity.js";
import {
  findPublicAuction,
  publicAuction,
  publicProduct,
  publicProducer,
} from "../services/publicAuction.js";

const router = Router();

router.get("/", async (request, response, next) => {
  try {
    const now = Date.now();
    const { estado } = request.query;
    if (
      estado !== undefined &&
      (typeof estado !== "string" ||
        !["agendado", "ativo", "terminado", "cancelado"].includes(estado))
    ) {
      return response.status(400).json({ erro: "Estado de leilão inválido." });
    }
    const auctions = await Auction.find(auctionStateFilter(estado, now))
      .sort({ dataFim: 1 })
      .populate({ ...publicProduct, select: "nome produtorId" })
      .populate({ ...publicProducer, select: "nome perfilProdutor.localidade" })
      .lean();
    response.json(
      auctions.map((auction) => publicAuction(auction, now)).filter(Boolean),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    const now = Date.now();
    if (!mongoose.isObjectIdOrHexString(request.params.id))
      return response.status(404).json({ erro: "Leilão não encontrado." });
    const result = await findPublicAuction(request.params.id, now);
    if (!result)
      return response.status(404).json({ erro: "Leilão não encontrado." });
    if (result.estado !== "terminado") return response.json(result);
    const currentBid = result.licitacaoAtual ?? { valor: result.precoBase, compradorId: null };
    const winnerId = currentBid.compradorId;
    const [order, winner] = winnerId
      ? await Promise.all([
          Order.findOne({ leilaoId: result._id }).select("_id").lean(),
          User.findById(winnerId).select("nome").lean(),
        ])
      : [null, null];
    response.json({
      ...result,
      resultado: {
        vencedor: Boolean(winnerId),
        vencedorId: winnerId ? String(winnerId) : null,
        vencedorNome: winner?.nome ?? null,
        valor: currentBid.valor,
        encomendaId: order ? String(order._id) : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  requireAuth("produtor"),
  requireApprovedProducer,
  requireObjectBody,
  async (request, response, next) => {
    let session;
    try {
      const now = Date.now();
      const { produtos, lote, precoBase, incremento, dataInicio, dataFim } =
        request.body || {};
      if (
        !Number.isSafeInteger(precoBase + incremento) ||
        !Number.isSafeInteger(precoBase) ||
        !Number.isSafeInteger(incremento)
      ) {
        return response.status(400).json({
          erro: "O lance mínimo do leilão excede o limite permitido.",
        });
      }
      if (
        !Array.isArray(produtos) ||
        !produtos.length ||
        produtos.some(
          (line) =>
            !line ||
            typeof line.produtoId !== "string" ||
            !mongoose.isObjectIdOrHexString(line.produtoId) ||
            !Number.isFinite(line.quantidade) ||
            line.quantidade <= 0,
        )
      ) {
        return response.status(400).json({
          erro: "Indica pelo menos um produto com quantidade válida.",
        });
      }
      const ids = produtos.map((line) => line.produtoId.toLowerCase());
      if (new Set(ids).size !== ids.length)
        return response
          .status(400)
          .json({ erro: "Os produtos do lote não podem repetir-se." });
      if (
        typeof dataInicio !== "string" ||
        !dataInicio.trim() ||
        typeof dataFim !== "string" ||
        !dataFim.trim()
      ) {
        return response
          .status(400)
          .json({ erro: "As datas do leilão são inválidas." });
      }
      const start = new Date(dataInicio);
      const end = new Date(dataFim);
      if (
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime()) ||
        start >= end ||
        end.getTime() <= now
      ) {
        return response
          .status(400)
          .json({ erro: "As datas do leilão são inválidas." });
      }
      session = await mongoose.startSession();
      let auction;
      await session.withTransaction(async () => {
        const byId = new Map();
        for (const id of [...ids].sort()) {
          const product = await Product.findOneAndUpdate(
            {
              _id: id,
              produtorId: request.user.id,
              publicado: true,
              bloqueado: { $ne: true },
            },
            {
              $inc: { revisaoLeiloes: 1 },
            },
            { new: true, session, timestamps: false },
          );
          if (!product)
            throw Object.assign(
              new Error("Produto não encontrado ou não pertence ao produtor."),
              { status: 404 },
            );
          byId.set(id, product);
        }
        const lines = produtos.map((line, index) => ({
          produtoId: ids[index],
          quantidade: line.quantidade,
          unidade: byId.get(ids[index]).unidade,
        }));
        if (
          lines.some(
            (line) => !validPurchaseQuantity(line.quantidade, line.unidade),
          )
        ) {
          throw Object.assign(
            new Error(
              "Indica quantidades válidas para a unidade de cada produto.",
            ),
            { status: 400 },
          );
        }
        if (
          lines.some((line) => line.quantidade > byId.get(line.produtoId).stock)
        ) {
          throw Object.assign(
            new Error("A quantidade de cada produto não pode exceder o stock."),
            { status: 400 },
          );
        }
        [auction] = await Auction.create(
          [
            {
              produtorId: request.user.id,
              produtos: lines,
              lote,
              precoBase,
              incremento,
              dataInicio: start,
              dataFim: end,
              estado: "agendado",
              reservaStock: "pendente",
              licitacaoAtual: { valor: precoBase, compradorId: null },
            },
          ],
          { session },
        );
      });
      auction.$session(null);
      await auction.populate("produtos.produtoId", "nome");
      response
        .status(201)
        .location(`/api/auctions/${auction.id}`)
        .json(auction);
    } catch (error) {
      next(error);
    } finally {
      if (session) await session.endSession();
    }
  },
);

export default router;
