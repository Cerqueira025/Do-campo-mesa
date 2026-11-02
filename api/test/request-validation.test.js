import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { User, Product, Order, Review, Auction } from "../src/models/index.js";

const id = "dca000000000000000000065";
const accounts = [
  { id: "dca000000000000000000002", papel: "comprador" },
  {
    id: "dca000000000000000000004",
    papel: "produtor",
    perfilProdutor: { validacao: "aceite" },
  },
  { id: "dca000000000000000000001", papel: "administrador" },
  {
    id: "dca000000000000000000005",
    papel: "produtor",
    perfilProdutor: { validacao: "pendente" },
  },
];
process.env.JWT_SECRET = "segredo-exclusivo-dos-testes-de-validacao";
const token = (index) =>
  jwt.sign({ id: accounts[index].id }, process.env.JWT_SECRET, {
    expiresIn: "2h",
  });
const writes = [
  { method: "POST", path: "/auth/registo" },
  { method: "POST", path: "/auth/login" },
  { method: "POST", path: "/auth/recuperar-password" },
  { method: "POST", path: "/products", account: 1 },
  { method: "PUT", path: `/products/${id}`, account: 1 },
  { method: "POST", path: "/orders", account: 0 },
  { method: "PATCH", path: `/orders/${id}/estado`, account: 1 },
  { method: "POST", path: "/reviews", account: 0 },
  { method: "POST", path: `/reviews/${id}/denuncias`, account: 0 },
  { method: "PATCH", path: `/reviews/${id}/moderacao`, account: 2 },
  { method: "PATCH", path: `/producers/${id}/validacao`, account: 2 },
  { method: "POST", path: "/auctions", account: 1 },
];
let server, base;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function call({ path, method = "GET", account }, raw) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(account === undefined
        ? {}
        : { Authorization: `Bearer ${token(account)}` }),
      ...(raw === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(raw === undefined ? {} : { body: raw }),
  });
  return { status: response.status, body: await response.json() };
}

function noBusinessAccess(t) {
  t.mock.method(User, "findById", (value) => ({
    select: async () => accounts.find((account) => account.id === value),
  }));
  const calls = [];
  for (const model of [User, Product, Order, Review, Auction]) {
    for (const method of [
      "find",
      "findOne",
      "create",
      "findOneAndUpdate",
      "findByIdAndUpdate",
      "countDocuments",
      "aggregate",
    ]) {
      t.mock.method(model, method, () => {
        calls.push(`${model.modelName}.${method}`);
        throw new Error("Acesso de negócio inesperado.");
      });
    }
  }
  t.mock.method(mongoose, "startSession", () => {
    calls.push("startSession");
    throw new Error("Transação inesperada.");
  });
  return calls;
}

for (const route of writes) {
  test(`${route.method} ${route.path} recusa corpos ausentes, arrays, null, primitivos e JSON malformado`, async (t) => {
    const calls = noBusinessAccess(t);
    for (const raw of [
      undefined,
      "",
      "[]",
      "[{}]",
      "null",
      "false",
      "1",
      '"texto"',
      "{",
    ]) {
      const response = await call(route, raw);
      assert.equal(response.status, 400, `corpo: ${raw}`);
      assert.equal(typeof response.body.erro, "string");
      assert.deepEqual(Object.keys(response.body), ["erro"]);
    }
    assert.deepEqual(calls, []);
  });
}

test("Objetos vazios chegam às validações de campos obrigatórios", async (t) => {
  const calls = noBusinessAccess(t);
  for (const route of writes.filter(
    (route) => !route.path.startsWith("/products"),
  )) {
    const response = await call(route, "{}");
    assert.equal(response.status, 400);
    assert.notEqual(
      response.body.erro,
      "O corpo do pedido deve ser um objeto JSON.",
    );
  }
  assert.deepEqual(calls, []);
});

test("Autenticação, papel e aprovação precedem a validação comum do corpo", async (t) => {
  const calls = noBusinessAccess(t);
  for (const route of writes.filter((route) => route.account !== undefined)) {
    assert.equal(
      (await call({ ...route, account: undefined }, "[]")).status,
      401,
    );
    const wrongRole = route.path.endsWith("/denuncias")
      ? 2
      : route.account === 0
        ? 1
        : 0;
    assert.equal(
      (await call({ ...route, account: wrongRole }, "[]")).status,
      403,
    );
  }
  for (const route of writes.filter(
    (route) => route.path.startsWith("/products") || route.path === "/auctions",
  )) {
    assert.equal((await call({ ...route, account: 3 }, "[]")).status, 403);
  }
  // O parser JSON continua global: sintaxe inválida é rejeitada antes da autenticação.
  assert.equal(
    (await call({ method: "POST", path: "/products" }, "{")).status,
    400,
  );
  assert.deepEqual(calls, []);
});

test("Catálogo recusa parâmetros conhecidos repetidos antes de consultar modelos", async (t) => {
  const calls = noBusinessAccess(t);
  for (const key of [
    "q",
    "categoria",
    "precoMin",
    "precoMax",
    "bio",
    "epoca",
    "localidade",
    "produtorId",
    "avaliacaoMin",
    "page",
    "limit",
  ]) {
    assert.equal(
      (await call({ path: `/products?${key}=1&${key}=2` })).status,
      400,
      key,
    );
  }
  assert.deepEqual(calls, []);
});

test("Catálogo recusa pesquisa em branco, números vazios ou não finitos e paginação insegura", async (t) => {
  const calls = noBusinessAccess(t);
  const queries = [
    "q=%20%20",
    "page=0",
    "page=1.5",
    "limit=101",
    "precoMin=2&precoMax=1",
    "page=9007199254740992",
    "page=9007199254740991&limit=2",
    "page=1e20",
    "page=Infinity",
  ];
  for (const key of ["precoMin", "precoMax", "avaliacaoMin", "page", "limit"]) {
    for (const value of ["", "%20", "NaN", "Infinity", "-Infinity"])
      queries.push(`${key}=${value}`);
  }
  queries.push("precoMin=1e308", "precoMax=9007199254740991");
  for (const query of queries) {
    assert.equal(
      (await call({ path: `/products?${query}` })).status,
      400,
      query,
    );
  }
  assert.deepEqual(calls, []);
});

test("Catálogo preserva defaults, filtros textuais vazios, parâmetros desconhecidos e conversões válidas", async (t) => {
  const calls = noBusinessAccess(t);
  let filter, skip, limit;
  t.mock.method(User, "find", () => ({ distinct: async () => [] }));
  t.mock.method(Product, "find", (value) => {
    filter = value;
    const query = {
      select() {
        return this;
      },
      sort() {
        return this;
      },
      skip(value) {
        skip = value;
        return this;
      },
      limit(value) {
        limit = value;
        return this;
      },
      populate: async () => [],
    };
    return query;
  });
  t.mock.method(Product, "countDocuments", async () => 0);
  for (const query of [
    "",
    "?q=&categoria=&localidade=&epoca=&produtorId=&extra=1&extra=2",
  ]) {
    assert.deepEqual(await call({ path: `/products${query}` }), {
      status: 200,
      body: { items: [], page: 1, limit: 24, total: 0 },
    });
    assert.deepEqual(filter, {
      publicado: true,
      bloqueado: { $ne: true },
      $and: [{ produtorId: { $in: [] } }],
    });
    assert.equal(skip, 0);
    assert.equal(limit, 24);
  }
  assert.equal(
    (
      await call({
        path: "/products?q=%20mel%20&precoMin=1.50&precoMax=1e1&bio=false&page=2&limit=10",
      })
    ).status,
    200,
  );
  assert.deepEqual(filter.preco, { $gte: 150, $lte: 1000 });
  assert.equal(filter.$and[0].$or[0].nome.$regex, "mel");
  assert.equal(filter.biologico, false);
  assert.equal(skip, 10);
  assert.equal(limit, 10);
  assert.equal(
    (await call({ path: "/products?page=9007199254740991&limit=1" })).status,
    200,
  );
  assert.equal(skip, Number.MAX_SAFE_INTEGER - 1);
  assert.deepEqual(calls, []);
});

test("Produtos preservam validação do Mongoose, conversões, campos desconhecidos e PUT vazio", async (t) => {
  noBusinessAccess(t);
  const data = {
    nome: "Mel",
    descricao: "Mel local",
    categoria: "Mel",
    preco: "150",
    unidade: "kg",
    stock: "2",
    imagens: ["https://example.test/mel.png"],
    campoDesconhecido: "ignorar",
  };
  let stored;
  t.mock.method(Product, "create", async (value) => {
    stored = new Product(value);
    await stored.validate();
    stored.populate = async () => stored;
    return stored;
  });
  assert.equal((await call(writes[3], "{}")).status, 400);
  const created = await call(writes[3], JSON.stringify(data));
  assert.equal(created.status, 201);
  assert.equal(created.body.preco, 150);
  assert.equal(created.body.stock, 2);
  assert.equal(created.body.imagens, undefined);
  assert.equal(created.body.campoDesconhecido, undefined);
  t.mock.method(Product, "findOne", () => ({ select: async () => stored }));
  stored.save = async () => {
    await stored.validate();
    return stored;
  };
  const updated = await call(writes[4], "{}");
  assert.equal(updated.status, 200);
  assert.equal(updated.body.nome, data.nome);
  assert.equal(updated.body.preco, 150);
});

test("Falhas inesperadas continuam a devolver 500 e conflitos continuam a devolver 409", async (t) => {
  noBusinessAccess(t);
  const log = t.mock.method(console, "error", () => {});
  t.mock.method(User, "find", () => {
    throw new TypeError("Falha interna simulada.");
  });
  assert.deepEqual(await call({ path: "/products" }), {
    status: 500,
    body: { erro: "Ocorreu um erro interno." },
  });
  assert.equal(log.mock.callCount(), 1);
  t.mock.method(Product, "create", async () => {
    throw Object.assign(new Error("Duplicado"), { code: 11000 });
  });
  assert.equal((await call(writes[3], "{}")).status, 409);
});
