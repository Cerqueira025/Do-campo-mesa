import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import Order from "../models/Order.js";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import { requireAuth } from "../middleware/auth.js";
import { requireObjectBody } from "../middleware/requestBody.js";
import { auctionState, auctionStateFilter } from "../domain/auction.js";
import { prepareDecision, decisionConflict } from "../services/moderation.js";

const router = Router();
router.use(requireAuth("administrador"));
const models = {
  users: User,
  products: Product,
  reviews: Review,
  orders: Order,
  auctions: Auction,
};
const fields = {
  users: "nome email papel perfilProdutor createdAt updatedAt ultimaDecisao",
  products:
    "nome descricao produtorId categoria preco unidade stock epoca biologico dataValidade publicado bloqueado createdAt updatedAt ultimaDecisao",
  reviews:
    "autorId encomendaId produtoId produtorId classificacao comentario estado createdAt updatedAt ultimaDecisao denuncias",
  orders:
    "compradorId produtorId linhas total estado entrega dataEntrega leilaoId createdAt updatedAt",
  auctions:
    "produtorId produtos lote precoBase incremento dataInicio dataFim estado reservaStock motivoCancelamento licitacaoAtual createdAt updatedAt",
};
const producerFields =
  "nome papel perfilProdutor.localidade perfilProdutor.validacao";
const regex = (value) => ({
  $regex: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  $options: "i",
});
const badQuery = () =>
  Object.assign(new Error("Filtros ou paginação inválidos."), { status: 400 });

export function readAdminQuery(query) {
  const allowed = [
    "page",
    "limit",
    "q",
    "papel",
    "validacao",
    "estado",
    "alvo",
    "categoria",
    "visibilidade",
    "origem",
    "produtorId",
    "compradorId",
  ];
  if (
    Object.entries(query).some(
      ([key, value]) =>
        !allowed.includes(key) ||
        typeof value !== "string" ||
        value.length > 100,
    )
  )
    throw badQuery();
  const page = Number(query.page ?? "1");
  const limit = Number(query.limit ?? "24");
  if (
    !/^\d+$/.test(query.page ?? "1") ||
    !/^\d+$/.test(query.limit ?? "24") ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger((page - 1) * limit)
  )
    throw badQuery();
  for (const name of ["produtorId", "compradorId"])
    if (query[name] && !mongoose.isObjectIdOrHexString(query[name]))
      throw badQuery();
  return { ...query, q: query.q?.trim() ?? "", page, limit };
}

function choice(query, name, values) {
  if (query[name] && !values.includes(query[name])) throw badQuery();
  return query[name];
}

async function listFilter(resource, query, now) {
  const resourceFilters = {
    users: ["papel", "validacao"],
    products: ["categoria", "visibilidade", "produtorId"],
    reviews: ["estado", "alvo", "produtorId"],
    orders: ["estado", "origem", "produtorId", "compradorId"],
    auctions: ["estado", "produtorId"],
  };
  if (
    Object.keys(query).some(
      (key) =>
        !["q", "page", "limit", ...resourceFilters[resource]].includes(key),
    )
  )
    throw badQuery();
  const filter = {};
  const clauses = [];
  for (const field of ["produtorId", "compradorId"])
    if (query[field]) filter[field] = query[field];
  if (resource === "users") {
    if (choice(query, "papel", ["comprador", "produtor", "administrador"]))
      filter.papel = query.papel;
    if (choice(query, "validacao", ["pendente", "aceite", "rejeitado"]))
      filter["perfilProdutor.validacao"] = query.validacao;
  }
  if (resource === "products") {
    if (query.categoria) filter.categoria = query.categoria;
    const visibility = choice(query, "visibilidade", [
      "publica",
      "despublicado",
      "bloqueado",
      "produtor-indisponivel",
    ]);
    if (visibility === "despublicado") filter.publicado = false;
    if (visibility === "bloqueado") filter.bloqueado = true;
    if (visibility === "publica" || visibility === "produtor-indisponivel") {
      const approved = await User.find({
        papel: "produtor",
        "perfilProdutor.validacao": "aceite",
      }).distinct("_id");
      clauses.push({
        produtorId: { [visibility === "publica" ? "$in" : "$nin"]: approved },
      });
      if (visibility === "publica")
        Object.assign(filter, { publicado: true, bloqueado: { $ne: true } });
    }
  }
  if (resource === "reviews") {
    if (choice(query, "estado", ["publicada", "denunciada", "oculta"]))
      filter.estado = query.estado;
    if (choice(query, "alvo", ["produto", "produtor"]))
      filter[query.alvo === "produto" ? "produtoId" : "produtorId"] = {
        $ne: null,
      };
  }
  if (resource === "orders") {
    if (
      choice(query, "estado", ["pendente", "confirmada", "pronta", "entregue"])
    )
      filter.estado = query.estado;
    if (choice(query, "origem", ["catalogo", "leilao"]))
      filter.leilaoId = query.origem === "leilao" ? { $ne: null } : null;
  }
  if (resource === "auctions") {
    choice(query, "estado", ["agendado", "ativo", "terminado", "cancelado"]);
    Object.assign(filter, auctionStateFilter(query.estado || undefined, now));
  }
  if (query.q) {
    const expression = regex(query.q);
    if (resource === "users")
      clauses.push({ $or: [{ nome: expression }, { email: expression }] });
    else {
      const users = await User.find({ nome: expression }).distinct("_id");
      const alternatives = [];
      if (resource === "products")
        alternatives.push({ nome: expression }, { produtorId: { $in: users } });
      if (resource === "auctions")
        alternatives.push({ lote: expression }, { produtorId: { $in: users } });
      if (resource === "orders") {
        alternatives.push(
          { compradorId: { $in: users } },
          { produtorId: { $in: users } },
        );
        if (mongoose.isObjectIdOrHexString(query.q))
          alternatives.push({ _id: query.q });
      }
      if (resource === "reviews") {
        const products = await Product.find({ nome: expression }).distinct(
          "_id",
        );
        alternatives.push(
          { comentario: expression },
          { autorId: { $in: users } },
          { produtorId: { $in: users } },
          { produtoId: { $in: products } },
        );
      }
      clauses.push({ $or: alternatives });
    }
  }
  if (clauses.length) filter.$and = clauses;
  return filter;
}

function populate(query, resource) {
  if (["users", "products", "reviews"].includes(resource))
    query.populate("ultimaDecisao.administradorId", "nome");
  if (["products", "reviews", "orders", "auctions"].includes(resource))
    query.populate("produtorId", producerFields);
  if (resource === "reviews")
    query
      .populate("autorId", "nome")
      .populate("produtoId", "nome")
      .populate("denuncias.autorId", "nome");
  if (resource === "orders") query.populate("compradorId", "nome");
  if (resource === "auctions")
    query
      .populate("produtos.produtoId", "nome produtorId publicado bloqueado")
      .populate("licitacaoAtual.compradorId", "nome");
  return query;
}

function decorate(item, resource, now) {
  if (resource === "reviews") {
    item.denuncias ??= [];
    item.totalDenuncias = item.denuncias.length;
  }
  if (resource === "products")
    item.visivel = Boolean(
      item.publicado &&
      !item.bloqueado &&
      item.produtorId?.perfilProdutor?.validacao === "aceite",
    );
  if (resource === "auctions") {
    item.estado = auctionState(item, now);
    item.visivel = Boolean(
      item.produtorId?.perfilProdutor?.validacao === "aceite" &&
      item.produtos?.length &&
      item.produtos.every(
        (line) =>
          line.produtoId?.publicado &&
          !line.produtoId.bloqueado &&
          String(line.produtoId.produtorId) === String(item.produtorId._id),
      ),
    );
  }
  return item;
}

router.get("/summary", async (_request, response, next) => {
  try {
    const [users, orders, pendingProducers, activeAuctions] = await Promise.all(
      [
        User.aggregate([{ $group: { _id: "$papel", total: { $sum: 1 } } }]),
        Order.aggregate([{ $group: { _id: "$estado", total: { $sum: 1 } } }]),
        User.countDocuments({
          papel: "produtor",
          "perfilProdutor.validacao": "pendente",
        }),
        Auction.countDocuments(auctionStateFilter("ativo", Date.now())),
      ],
    );
    response.json({
      users: Object.fromEntries(users.map((item) => [item._id, item.total])),
      orders: Object.fromEntries(orders.map((item) => [item._id, item.total])),
      pendingProducers,
      activeAuctions,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/products/:id/moderacao",
  requireObjectBody,
  async (request, response, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(request.params.id))
        return response.status(404).json({ erro: "Produto não encontrado." });
      if (typeof request.body.bloqueado !== "boolean")
        return response
          .status(400)
          .json({ erro: "Indique se pretende ocultar ou repor o produto." });
      const decision = prepareDecision(
        request.body,
        request.user.id,
        request.body.bloqueado,
      );
      const product = await Product.findOneAndUpdate(
        { _id: request.params.id, ...decision.filter },
        {
          $set: {
            bloqueado: request.body.bloqueado,
            ultimaDecisao: decision.value,
          },
          $inc: { revisaoLeiloes: 1 },
        },
        { new: true, runValidators: true },
      ).select("_id bloqueado");
      if (!product) {
        if (!(await Product.exists({ _id: request.params.id })))
          return response.status(404).json({ erro: "Produto não encontrado." });
        return decisionConflict(response);
      }
      response.json({ _id: product._id, bloqueado: product.bloqueado });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/:resource", async (request, response, next) => {
  try {
    const { resource } = request.params;
    if (!Object.hasOwn(models, resource))
      return response.status(404).json({ erro: "Área não encontrada." });
    const query = readAdminQuery(request.query);
    const now = Date.now();
    const filter = await listFilter(resource, query, now);
    const sort =
      resource === "auctions"
        ? { dataFim: 1, _id: 1 }
        : resource === "users" && query.validacao === "pendente"
          ? { createdAt: 1, _id: 1 }
          : { createdAt: -1, _id: 1 };
    const [total, categorias] = await Promise.all([
      models[resource].countDocuments(filter),
      resource === "products" ? Product.distinct("categoria") : undefined,
    ]);
    const page = Math.min(
      query.page,
      Math.max(1, Math.ceil(total / query.limit)),
    );
    const items = await populate(
      models[resource]
        .find(filter)
        .select(fields[resource])
        .sort(sort)
        .skip((page - 1) * query.limit)
        .limit(query.limit),
      resource,
    ).lean();
    response.json({
      items: items.map((item) => decorate(item, resource, now)),
      page,
      limit: query.limit,
      total,
      ...(categorias
        ? { categorias: categorias.sort((a, b) => a.localeCompare(b, "pt-PT")) }
        : {}),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:resource/:id", async (request, response, next) => {
  try {
    const { resource, id } = request.params;
    if (
      !Object.hasOwn(models, resource) ||
      resource === "orders" ||
      !mongoose.isObjectIdOrHexString(id)
    )
      return response.status(404).json({ erro: "Registo não encontrado." });
    const item = await populate(
      models[resource].findById(id).select(fields[resource]),
      resource,
    ).lean();
    if (!item)
      return response.status(404).json({ erro: "Registo não encontrado." });
    if (resource === "products") {
      item.leiloes = await Auction.find({ "produtos.produtoId": id })
        .select(
          "lote estado dataInicio dataFim reservaStock licitacaoAtual.valor",
        )
        .sort({ dataFim: 1, _id: 1 })
        .lean();
      const now = Date.now();
      item.leiloes = item.leiloes.map((auction) => ({
        ...auction,
        estado: auctionState(auction, now),
      }));
    }
    if (resource === "auctions")
      item.licitacoes = await Bid.find({ leilaoId: id })
        .select("valor compradorId createdAt")
        .sort({ createdAt: -1, _id: 1 })
        .limit(20)
        .populate("compradorId", "nome")
        .lean();
    response.json(decorate(item, resource, Date.now()));
  } catch (error) {
    next(error);
  }
});

export default router;
