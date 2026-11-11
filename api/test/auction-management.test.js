import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Auction from "../src/models/Auction.js";
import Product from "../src/models/Product.js";
import Bid from "../src/models/Bid.js";
const owner = "dca000000000000000000004";
const id = "dca000000000000000004001";
const secret = "auction-management-tests-only-secret";
let server, base;
before(async () => {
  process.env.JWT_SECRET = secret;
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/auctions`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
function auth(t, papel = "produtor", validacao = "aceite") {
  t.mock.method(User, "findById", () => ({
    select: async () =>
      new User({
        _id: owner,
        papel,
        nome: "Produtor",
        email: "a@example.test",
        perfilProdutor: papel === "produtor" ? { validacao } : undefined,
      }),
  }));
}
async function call(path = "", method = "GET", body, token = true) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token
        ? {
            Authorization: `Bearer ${jwt.sign({ id: owner }, secret, { expiresIn: "1h" })}`,
          }
        : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("Consultas de leilões exigem autenticação e aprovação", async (t) => {
  const paths = ["/mine", `/mine/${id}`, `/mine/${id}/bids`];
  for (const path of paths) assert.equal((await call(path, "GET", undefined, false)).status, 401);
  for (const [role, approval] of [["comprador"], ["administrador"], ["produtor", "pendente"], ["produtor", "rejeitado"]]) {
    auth(t, role, approval);
    for (const path of paths) assert.equal((await call(path)).status, 403);
    t.mock.restoreAll();
  }
});

test("Histórico privado confirma a propriedade antes de consultar licitações", async (t) => {
  auth(t);
  t.mock.method(Auction, "exists", async (filter) => {
    assert.deepEqual(filter, { _id: id, produtorId: owner });
    return null;
  });
  t.mock.method(Bid, "find", () => assert.fail("Consulta inesperada"));
  assert.equal((await call(`/mine/${id}/bids`)).status, 404);
  assert.equal((await call("/mine/invalido/bids")).status, 404);
  assert.equal((await call(`/mine/${id}/bids?page=0`)).status, 400);
});

test("Histórico devolve o nome do licitador e trata compradores removidos", async (t) => {
  auth(t);
  t.mock.method(Auction, "exists", async () => ({ _id: id }));
  const filter = { leilaoId: id };
  const createdAt = "2026-11-04T21:56:00.000Z";
  t.mock.method(Bid, "find", (value) => {
    assert.deepEqual(value, filter);
    return {
      select(fields) {
        assert.equal(fields, "_id valor createdAt compradorId");
        return this;
      },
      sort(order) {
        assert.deepEqual(order, { createdAt: -1, _id: -1 });
        return this;
      },
      skip(offset) {
        assert.equal(offset, 1);
        return this;
      },
      limit(size) {
        assert.equal(size, 1);
        return this;
      },
      populate(path, fields) {
        assert.equal(path, "compradorId");
        assert.equal(fields, "nome");
        return this;
      },
      async lean() {
        return [
          { _id: id, valor: 4500, createdAt, compradorId: { nome: "Ana" } },
          { _id: owner, valor: 4400, createdAt, compradorId: null },
        ];
      },
    };
  });
  t.mock.method(Bid, "countDocuments", async (value) => {
    assert.deepEqual(value, filter);
    return 2;
  });
  const response = await call(`/mine/${id}/bids?page=2&limit=1`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    items: [
      { _id: id, valor: 4500, createdAt, nome: "Ana" },
      { _id: owner, valor: 4400, createdAt, nome: "Comprador" },
    ],
    page: 2,
    limit: 1,
    total: 2,
  });
});
const sample = {
  _id: id, lote: "Cabaz", precoBase: 500, incremento: 100,
  produtos: [{ produtoId: { _id: owner, nome: "Batata", publicado: false, bloqueado: true }, quantidade: 2, unidade: "kg" }],
  dataInicio: new Date(Date.now() - 5000), dataFim: new Date(Date.now() + 600000),
  estado: "ativo", reservaStock: "reservada", licitacaoAtual: { valor: 600, compradorId: "privado" },
};
test("Lista apenas leilões próprios e não expõe licitantes ou filtra produtos privados", async (t) => {
  auth(t);
  const query = { select() { return this; }, sort(value) { assert.deepEqual(value, { createdAt: -1, _id: 1 }); return this; }, skip(value) { assert.equal(value, 24); return this; }, limit(value) { assert.equal(value, 24); return this; }, populate(value) { assert.equal(value.match, undefined); return this; }, async lean() { return [sample]; } };
  t.mock.method(Auction, "find", (filter) => { assert.deepEqual(filter, { produtorId: owner }); return query; });
  t.mock.method(Auction, "countDocuments", async () => 25);
  const response = await call("/mine?page=2&limit=24");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 25);
  assert.equal(body.items[0].produtos[0].produtoId.nome, "Batata");
  assert.deepEqual(body.items[0].licitacaoAtual, { valor: 600 });
  assert.equal(body.items[0].estado, "ativo");
  assert.equal(body.items[0].visivel, false);
});
test("Detalhe limita propriedade e devolve 404 para outro produtor ou ID inválido", async (t) => {
  auth(t);
  t.mock.method(Auction, "findOne", (filter) => {
    assert.deepEqual(filter, { _id: id, produtorId: owner });
    return { select() { return this; }, populate() { return this; }, async lean() { return null; } };
  });
  assert.equal((await call(`/mine/${id}`)).status, 404);
  assert.equal((await call("/mine/invalido")).status, 404);
});
test("Paginação inválida é rejeitada antes da consulta", async (t) => {
  auth(t);
  for (const suffix of ["page=0", "limit=101", "limit=1.5", "page=9007199254740992", "page=1&page=2"])
    assert.equal((await call(`/mine?${suffix}`)).status, 400);
});

test("Detalhe privado inclui produtos indisponíveis e calcula o estado terminado", async (t) => {
  auth(t);
  t.mock.method(Auction, "findOne", () => ({
    select() { return this; }, populate(value) { assert.equal(value.match, undefined); return this; },
    async lean() { return { ...sample, dataFim: new Date(Date.now() - 1000), produtos: [{ produtoId: null, quantidade: 2, unidade: "kg" }] }; },
  }));
  const response = await call(`/mine/${id}`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.estado, "terminado");
  assert.equal(body.produtos[0].produtoId, null);
  assert.equal(body.visivel, false);
  assert.deepEqual(body.licitacaoAtual, { valor: 600 });
});

test("Rejeita filtros inválidos ou repetidos", async (t) => {
  auth(t);
  t.mock.method(Auction, "find", () => assert.fail("Consulta inesperada"));
  for (const query of [
    "estado=",
    "estado=desconhecido",
    "estado=ativo&estado=terminado",
    "visibilidade=publica",
    "visibilidade=indisponivel&visibilidade=indisponivel",
  ])
    assert.equal((await call(`/mine?${query}`)).status, 400);
});

test("Combina estado e visibilidade antes de contar e paginar os leilões do produtor", async (t) => {
  auth(t);
  const item = {
    ...sample,
    estado: "cancelado",
    produtos: [
      {
        ...sample.produtos[0],
        produtoId: {
          _id: owner,
          nome: "Batata",
          publicado: true,
          produtorId: owner,
        },
      },
      {
        ...sample.produtos[0],
        produtoId: {
          _id: id,
          nome: "Cebola",
          publicado: true,
          bloqueado: true,
          produtorId: owner,
        },
      },
    ],
  };
  t.mock.method(Product, "find", (filter) => {
    assert.deepEqual(filter, {
      produtorId: owner,
      publicado: true,
      bloqueado: { $ne: true },
    });
    return {
      async distinct(field) {
        assert.equal(field, "_id");
        return [owner];
      },
    };
  });
  const expected = {
    produtorId: owner,
    estado: "cancelado",
    $and: [
      {
        $or: [
          { "produtos.0": { $exists: false } },
          { produtos: { $elemMatch: { produtoId: { $nin: [owner] } } } },
        ],
      },
    ],
  };
  t.mock.method(Auction, "find", (filter) => {
    assert.deepEqual(filter, expected);
    return {
      select() {
        return this;
      },
      sort() {
        return this;
      },
      populate() {
        return this;
      },
      skip(value) {
        assert.equal(value, 1);
        return this;
      },
      limit(value) {
        assert.equal(value, 1);
        return this;
      },
      async lean() {
        return [item];
      },
    };
  });
  t.mock.method(Auction, "countDocuments", async (filter) => {
    assert.deepEqual(filter, expected);
    return 2;
  });
  const response = await call(
    "/mine?page=2&limit=1&estado=cancelado&visibilidade=indisponivel",
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 2);
  assert.equal(body.items[0].visivel, false);
  assert.deepEqual(
    body.items[0].produtos.map(({ produtoId }) => produtoId.nome),
    ["Batata", "Cebola"],
  );
});
