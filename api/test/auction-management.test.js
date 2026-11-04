import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Auction from "../src/models/Auction.js";
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
  for (const path of ["/mine", `/mine/${id}`]) assert.equal((await call(path, "GET", undefined, false)).status, 401);
  for (const [role, approval] of [["comprador"], ["administrador"], ["produtor", "pendente"], ["produtor", "rejeitado"]]) {
    auth(t, role, approval);
    for (const path of ["/mine", `/mine/${id}`]) assert.equal((await call(path)).status, 403);
    t.mock.restoreAll();
  }
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
  assert.deepEqual(body.licitacaoAtual, { valor: 600 });
});
