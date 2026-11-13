import { Router } from "express";
import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { requireApprovedProducer, requireAuth } from "../middleware/auth.js";
import { requireObjectBody } from "../middleware/requestBody.js";
import { auctionState, auctionStateFilter } from "../domain/auction.js";
import { validPurchaseQuantity } from "../domain/purchaseQuantity.js";
import {
  auctionProductsBelongTo,
  findPublicAuction,
  publicAuction,
  publicProduct,
  publicProducer,
} from "../services/publicAuction.js";

const router = Router();
const auctionStates = ["agendado", "ativo", "terminado", "cancelado"];

function managementPagination({ page = "1", limit = "24" }) {
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;
  if (
    [page, limit].some(
      (value) => typeof value !== "string" || !/^\d+$/.test(value),
    ) ||
    !Number.isSafeInteger(pageNumber) ||
    pageNumber < 1 ||
    !Number.isSafeInteger(skip) ||
    limitNumber < 1 ||
    limitNumber > 100
  )
    return null;
  return { page: pageNumber, limit: limitNumber, skip };
}

router.get("/", async (request, response, next) => {
  try {
    const now = Date.now();
    const { estado } = request.query;
    if (estado !== undefined && !auctionStates.includes(estado)) {
      return response.status(400).json({ erro: "Estado de leilão inválido." });
    }
    const auctions = await Auction.find(auctionStateFilter(estado, now))
      .sort({ dataFim: 1 })
      .populate({ ...publicProduct, select: "nome fotografia produtorId" })
      .populate({ ...publicProducer, select: "nome perfilProdutor.localidade" })
      .lean();
    response.json(
      auctions.map((auction) => publicAuction(auction, now)).filter(Boolean),
    );
  } catch (error) {
    next(error);
  }
});

const managementFields =
  "lote produtos precoBase incremento dataInicio dataFim estado reservaStock motivoCancelamento licitacaoAtual.valor createdAt";
const managementPopulate = {
  path: "produtos.produtoId",
  select: "nome produtorId publicado bloqueado",
};
const managementAuction = (
  auction,
  now,
  producerId,
  onlyUnavailable = false,
) => ({
  _id: auction._id,
  lote: auction.lote,
  produtos: (auction.produtos ?? []).map((line) => ({
    produtoId: line.produtoId
      ? { _id: line.produtoId._id, nome: line.produtoId.nome }
      : null,
    quantidade: line.quantidade,
    unidade: line.unidade,
  })),
  precoBase: auction.precoBase,
  incremento: auction.incremento,
  dataInicio: auction.dataInicio,
  dataFim: auction.dataFim,
  estado: auctionState(auction, now),
  visivel:
    !onlyUnavailable &&
    auctionProductsBelongTo(auction, producerId) &&
    auction.produtos.every(
      ({ produtoId }) =>
        produtoId.publicado === true && produtoId.bloqueado !== true,
    ),
  reservaStock: auction.reservaStock,
  ...(auction.motivoCancelamento
    ? { motivoCancelamento: auction.motivoCancelamento }
    : {}),
  licitacaoAtual: { valor: auction.licitacaoAtual.valor },
});

router.get(
  "/mine",
  requireAuth("produtor"),
  requireApprovedProducer,
  async (request, response, next) => {
    try {
      const { estado, visibilidade } = request.query;
      const pagination = managementPagination(request.query);
      if (!pagination)
        return response.status(400).json({ erro: "Paginação inválida." });
      const { page, limit, skip } = pagination;
      if (estado !== undefined && !auctionStates.includes(estado))
        return response
          .status(400)
          .json({ erro: "Estado de leilão inválido." });
      if (visibilidade !== undefined && visibilidade !== "indisponivel")
        return response
          .status(400)
          .json({ erro: "Visibilidade de leilão inválida." });

      const producerId = request.user.id;
      const now = Date.now();
      const filter = {
        produtorId: producerId,
        ...auctionStateFilter(estado, now),
      };
      if (visibilidade) {
        const publicIds = await Product.find({
          ...publicProduct.match,
          produtorId: producerId,
        }).distinct("_id");
        filter.$and = [
          {
            $or: [
              { "produtos.0": { $exists: false } },
              { produtos: { $elemMatch: { produtoId: { $nin: publicIds } } } },
            ],
          },
        ];
      }
      const [items, total] = await Promise.all([
        Auction.find(filter)
          .select(managementFields)
          .sort({ createdAt: -1, _id: 1 })
          .skip(skip)
          .limit(limit)
          .populate(managementPopulate)
          .lean(),
        Auction.countDocuments(filter),
      ]);
      response.set("Cache-Control", "no-store").json({
        items: items.map((item) =>
          managementAuction(item, now, producerId, Boolean(visibilidade)),
        ),
        page,
        limit,
        total,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/mine/:id",
  requireAuth("produtor"),
  requireApprovedProducer,
  async (request, response, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(request.params.id))
        return response.status(404).json({ erro: "Leilão não encontrado." });
      const auction = await Auction.findOne({
        _id: request.params.id,
        produtorId: request.user.id,
      })
        .select(managementFields)
        .populate(managementPopulate)
        .lean();
      if (!auction)
        return response.status(404).json({ erro: "Leilão não encontrado." });
      response
        .set("Cache-Control", "no-store")
        .json(managementAuction(auction, Date.now(), request.user.id));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/mine/:id/bids",
  requireAuth("produtor"),
  requireApprovedProducer,
  async (request, response, next) => {
    try {
      const { id } = request.params;
      if (!mongoose.isObjectIdOrHexString(id))
        return response.status(404).json({ erro: "Leilão não encontrado." });
      const pagination = managementPagination(request.query);
      if (!pagination)
        return response.status(400).json({ erro: "Paginação inválida." });
      if (!(await Auction.exists({ _id: id, produtorId: request.user.id })))
        return response.status(404).json({ erro: "Leilão não encontrado." });

      const { page, limit, skip } = pagination;
      const filter = { leilaoId: id };
      const [bids, total] = await Promise.all([
        Bid.find(filter)
          .select("_id valor createdAt compradorId")
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .populate("compradorId", "nome")
          .lean(),
        Bid.countDocuments(filter),
      ]);
      const items = bids.map(({ _id, valor, createdAt, compradorId }) => ({
        _id,
        valor,
        createdAt,
        nome: compradorId?.nome ?? "Comprador",
      }));
      response
        .set("Cache-Control", "no-store")
        .json({ items, page, limit, total });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/:id", async (request, response, next) => {
  try {
    const now = Date.now();
    if (!mongoose.isObjectIdOrHexString(request.params.id))
      return response.status(404).json({ erro: "Leilão não encontrado." });
    const result = await findPublicAuction(request.params.id, now);
    if (!result)
      return response.status(404).json({ erro: "Leilão não encontrado." });
    if (result.estado !== "terminado") return response.json(result);
    const currentBid = result.licitacaoAtual ?? {
      valor: result.precoBase,
      compradorId: null,
    };
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
