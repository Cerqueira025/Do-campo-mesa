import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import admin, { readAdminQuery } from "../src/routes/admin.js";
import { prepareDecision } from "../src/services/moderation.js";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";
import Review from "../src/models/Review.js";
import Order from "../src/models/Order.js";
import Auction from "../src/models/Auction.js";
import Bid from "../src/models/Bid.js";

const id = "dca000000000000000000065";
const adminId = "dca000000000000000000001";
const anotherAdmin = "dca000000000000000000006";
const secret = "admin-tests-private-secret-at-least-32-characters";
let server, base;
before(async () => {
  process.env.JWT_SECRET = secret;
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const query = (data, inspect = () => {}) => ({
  select(value) {
    inspect("select", value);
    return this;
  },
  populate(value) {
    inspect("populate", value);
    return this;
  },
  sort(value) {
    inspect("sort", value);
    return this;
  },
  skip(value) {
    inspect("skip", value);
    return this;
  },
  limit(value) {
    inspect("limit", value);
    return this;
  },
  async lean() {
    return structuredClone(data);
  },
  async distinct() {
    return data.map((item) => item._id);
  },
  then(resolve, reject) {
    return this.lean().then(resolve, reject);
  },
});
function authorize(t, papel = "administrador") {
  t.mock.method(User, "findById", (value) => query({ id: value, papel }));
}
async function call(path, { method = "GET", body, user = adminId } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(user
        ? {
            Authorization: `Bearer ${jwt.sign({ id: user }, secret, { expiresIn: "1h" })}`,
          }
        : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

test("Consultas administrativas validam paginação, pesquisa limitada e identificadores", () => {
  assert.deepEqual(readAdminQuery({}), { q: "", page: 1, limit: 24 });
  assert.equal(readAdminQuery({ page: "2", q: "  mel  " }).q, "mel");
  for (const input of [
    { page: "0" },
    { page: "1.5" },
    { page: "9999999999999999" },
    { limit: "101" },
    { q: ["a", "b"] },
    { q: "a".repeat(101) },
    { produtorId: "invalido" },
    { $where: "x" },
  ]) {
    assert.throws(
      () => readAdminQuery(input),
      (error) => error.status === 400,
    );
  }
});

test("Todas as consultas e a moderação de produtos exigem o papel atual de administrador", async (t) => {
  authorize(t, "comprador");
  const paths = [
    "/admin/summary",
    ...["users", "products", "reviews", "orders", "auctions"].map(
      (resource) => `/admin/${resource}`,
    ),
    `/admin/products/${id}`,
  ];
  for (const path of paths) {
    assert.equal((await call(path, { user: null })).status, 401);
    assert.equal((await call(path)).status, 403);
  }
  assert.equal(
    (
      await call(`/admin/products/${id}/moderacao`, {
        method: "PATCH",
        body: { bloqueado: true },
      })
    ).status,
    403,
  );
});

test("Resumo conta todos os registos e usa o estado efetivo para leilões ativos", async (t) => {
  authorize(t);
  t.mock.method(User, "aggregate", async () => [
    { _id: "comprador", total: 4 },
  ]);
  t.mock.method(Order, "aggregate", async () => [
    { _id: "entregue", total: 7 },
  ]);
  t.mock.method(User, "countDocuments", async (filter) => {
    assert.equal(filter["perfilProdutor.validacao"], "pendente");
    return 2;
  });
  t.mock.method(Auction, "countDocuments", async (filter) => {
    assert.equal(filter.reservaStock, "reservada");
    assert.ok(filter.dataFim.$gt);
    return 3;
  });
  assert.deepEqual(await call("/admin/summary"), {
    status: 200,
    body: {
      users: { comprador: 4 },
      orders: { entregue: 7 },
      pendingProducers: 2,
      activeAuctions: 3,
    },
  });
});

test("Listagem pesquisa texto literal, filtra papéis, pagina no servidor e ordena pendentes primeiro", async (t) => {
  authorize(t);
  let filter;
  const operations = {};
  t.mock.method(User, "find", (value) => {
    filter = value;
    return query([{ _id: id, nome: "Quinta" }], (key, value) => {
      operations[key] = value;
    });
  });
  t.mock.method(User, "countDocuments", async () => 30);
  const result = await call(
    "/admin/users?papel=produtor&validacao=pendente&q=Quinta.*&page=2",
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 30);
  assert.equal(result.body.page, 2);
  assert.equal(result.body.items.length, 1);
  assert.equal(filter.papel, "produtor");
  assert.equal(filter.$and[0].$or[0].nome.$regex, "Quinta\\.\\*");
  assert.deepEqual(operations.sort, { createdAt: 1, _id: 1 });
  assert.equal(operations.skip, 24);
  assert.equal(operations.limit, 24);
  assert.equal(operations.select.includes("passwordHash"), false);
});

test("Detalhe de produto oculto inclui leilões associados; referências removidas não impedem consulta", async (t) => {
  authorize(t);
  t.mock.method(Product, "findById", () =>
    query({
      _id: id,
      nome: "Batata",
      publicado: true,
      bloqueado: true,
      produtorId: null,
    }),
  );
  t.mock.method(Auction, "find", () =>
    query([{ _id: id, lote: "Lote", estado: "ativo" }]),
  );
  const result = await call(`/admin/products/${id}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.visivel, false);
  assert.equal(result.body.leiloes.length, 1);
  assert.equal((await call("/admin/products/invalido")).status, 404);
  assert.equal((await call("/admin/inexistente")).status, 404);
});

test("Administração consulta autores e motivos das denúncias e mantém compatibilidade com avaliações antigas", async (t) => {
  authorize(t);
  const records = [
    {
      _id: id,
      estado: "denunciada",
      denuncias: [
        {
          autorId: { _id: anotherAdmin, nome: "Denunciante" },
          motivo: "Analisar",
          data: "2026-01-01T00:00:00Z",
        },
      ],
    },
    { _id: anotherAdmin, estado: "publicada" },
  ];
  t.mock.method(Review, "find", () => query(records));
  t.mock.method(Review, "countDocuments", async () => records.length);
  t.mock.method(Review, "findById", () => query(records[0]));
  const list = await call("/admin/reviews?estado=denunciada");
  assert.equal(list.status, 200);
  assert.equal(list.body.items[0].totalDenuncias, 1);
  assert.equal(list.body.items[1].totalDenuncias, 0);
  assert.deepEqual(list.body.items[1].denuncias, []);
  const detail = await call(`/admin/reviews/${id}`);
  assert.equal(detail.body.denuncias[0].motivo, "Analisar");
  assert.equal(detail.body.denuncias[0].autorId.nome, "Denunciante");
});

test("Projeção real do Mongoose não seleciona denuncias e denuncias.autorId em simultâneo", async (t) => {
  authorize(t);
  const projections = [];
  const inspect = (options) => {
    const projection = options.projection;
    projections.push(projection);
    assert.equal(projection.denuncias, 1);
    assert.equal(projection["denuncias.autorId"], undefined);
  };
  // Intercetar apenas o acesso ao driver conserva a projeção e os populate reais.
  t.mock.method(Review.collection, "find", (_filter, options) => {
    inspect(options);
    return { toArray: async () => [] };
  });
  t.mock.method(Review.collection, "countDocuments", async () => 0);
  t.mock.method(Review.collection, "findOne", async (_filter, options) => {
    inspect(options);
    return {
      _id: id,
      classificacao: 4,
      comentario: "Original",
      estado: "publicada",
    };
  });
  const list = await call("/admin/reviews");
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.items, []);
  const detail = await call(`/admin/reviews/${id}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.denuncias, []);
  assert.equal(projections.length, 2);
});

test("Detalhe administrativo de leilão inclui os últimos vinte lances mesmo com produto removido", async (t) => {
  authorize(t);
  t.mock.method(Auction, "findById", () =>
    query({
      _id: id,
      estado: "ativo",
      reservaStock: "reservada",
      dataInicio: new Date(Date.now() - 1000),
      dataFim: new Date(Date.now() + 60000),
      produtos: [{ produtoId: null }],
    }),
  );
  t.mock.method(Bid, "find", () =>
    query([], (name, value) => {
      if (name === "limit") assert.equal(value, 20);
    }),
  );
  const result = await call(`/admin/auctions/${id}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.visivel, false);
  assert.deepEqual(result.body.licitacoes, []);
});

test("Ocultar e repor preserva publicação e stock, exige motivo e recusa uma decisão desatualizada", async (t) => {
  authorize(t);
  const product = {
    _id: id,
    publicado: false,
    stock: 10,
    bloqueado: false,
    ultimaDecisao: undefined,
  };
  t.mock.method(Product, "findOneAndUpdate", (filter, update) => {
    assert.deepEqual(Object.keys(update.$set).sort(), [
      "bloqueado",
      "ultimaDecisao",
    ]);
    const previous = product.ultimaDecisao?.data?.getTime() ?? null;
    if ((filter["ultimaDecisao.data"]?.getTime() ?? null) !== previous)
      return query(null);
    Object.assign(product, update.$set);
    return query({ _id: id, bloqueado: product.bloqueado });
  });
  t.mock.method(Product, "exists", async () => ({ _id: id }));
  const path = `/admin/products/${id}/moderacao`;
  assert.equal(
    (await call(path, { method: "PATCH", body: { bloqueado: true } })).status,
    400,
  );
  assert.equal(
    (
      await call(path, {
        method: "PATCH",
        body: { bloqueado: true, motivo: "Conteúdo inadequado" },
      })
    ).status,
    200,
  );
  assert.equal(product.ultimaDecisao.motivo, "Conteúdo inadequado");
  assert.equal(
    (await call(path, { method: "PATCH", body: { bloqueado: false } })).status,
    409,
  );
  const previous = product.ultimaDecisao.data.toISOString();
  assert.equal(
    (
      await call(path, {
        method: "PATCH",
        user: anotherAdmin,
        body: { bloqueado: false, decisaoAnterior: previous },
      })
    ).status,
    200,
  );
  assert.equal(product.ultimaDecisao.administradorId, anotherAdmin);
  assert.equal(product.bloqueado, false);
  assert.equal(product.publicado, false);
  assert.equal(product.stock, 10);
});

test("Motivos administrativos ficam privados nas serializações de produtos, avaliações e utilizadores", () => {
  const ultimaDecisao = {
    administradorId: adminId,
    data: new Date(),
    motivo: "Privado",
  };
  for (const Model of [Product, Review, User]) {
    const document = new Model({ ultimaDecisao });
    assert.equal(document.toJSON().ultimaDecisao, undefined);
    assert.equal(document.toJSON().bloqueado, undefined);
    assert.equal(Model.schema.path("ultimaDecisao").options.select, false);
  }
  assert.throws(
    () => prepareDecision({ motivo: " " }, adminId, true),
    (error) => error.status === 400,
  );
  assert.throws(
    () => prepareDecision({ motivo: "x".repeat(501) }, adminId, false),
    (error) => error.status === 400,
  );
  assert.throws(
    () => prepareDecision({ decisaoAnterior: {} }, adminId, false),
    (error) => error.status === 400,
  );
});

test("Avaliações exigem motivo ao ocultar e permitem republicação por outro administrador com a decisão atual", async (t) => {
  authorize(t);
  const review = new Review({
    _id: id,
    autorId: anotherAdmin,
    encomendaId: id,
    produtoId: id,
    classificacao: 4,
    comentario: "Original",
    estado: "publicada",
  });
  t.mock.method(Review, "findOneAndUpdate", (filter, update) => ({
    async populate() {
      if (
        (filter["ultimaDecisao.data"]?.getTime() ?? null) !==
        (review.ultimaDecisao?.data?.getTime() ?? null)
      )
        return null;
      review.set(update.$set);
      return review;
    },
  }));
  t.mock.method(Review, "exists", async () => ({ _id: id }));
  const path = `/reviews/${id}/moderacao`;
  assert.equal(
    (await call(path, { method: "PATCH", body: { estado: "oculta" } })).status,
    400,
  );
  const hidden = await call(path, {
    method: "PATCH",
    body: { estado: "oculta", motivo: "Linguagem inadequada" },
  });
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.estado, "oculta");
  assert.equal(hidden.body.ultimaDecisao, undefined);
  assert.equal(
    (await call(path, { method: "PATCH", body: { estado: "publicada" } }))
      .status,
    409,
  );
  const restored = await call(path, {
    method: "PATCH",
    user: anotherAdmin,
    body: {
      estado: "publicada",
      decisaoAnterior: review.ultimaDecisao.data.toISOString(),
    },
  });
  assert.equal(restored.status, 200);
  assert.equal(review.estado, "publicada");
  assert.equal(review.comentario, "Original");
  assert.equal(review.classificacao, 4);
  assert.equal(String(review.ultimaDecisao.administradorId), anotherAdmin);
});

test("Corpos inválidos de moderação são rejeitados antes da persistência", async (t) => {
  authorize(t);
  t.mock.method(Product, "findOneAndUpdate", () => {
    throw new Error("Não escrever");
  });
  for (const body of [
    {},
    { bloqueado: "true" },
    { bloqueado: true, motivo: { $ne: null } },
  ]) {
    assert.equal(
      (await call(`/admin/products/${id}/moderacao`, { method: "PATCH", body }))
        .status,
      400,
    );
  }
  const handler = admin.stack
    .find((layer) => layer.route?.path === "/:resource")
    .route.stack.at(-1).handle;
  let error;
  await handler(
    { params: { resource: "auctions" }, query: { estado: "invalido" } },
    {},
    (failure) => {
      error = failure;
    },
  );
  assert.equal(error.status, 400);
});
