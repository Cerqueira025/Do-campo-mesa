import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "../src/app.js";
import User from "../src/models/User.js";
import BackofficeCode from "../src/models/BackofficeCode.js";
import { hashCode } from "../src/routes/backoffice.js";
import { registerSockets } from "../src/sockets/index.js";
import { checkSocket, timedCheck } from "../src/services/serviceChecks.js";

const secret = "backoffice-tests-jwt-secret-at-least-32-characters";
const integration =
  "backoffice-tests-integration-secret-at-least-32-characters";
const id = "dca000000000000000000001";
const state = "a".repeat(64);
let server, base;
before(async () => {
  process.env.JWT_SECRET = secret;
  process.env.BACKOFFICE_SECRET = integration;
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
const user = (papel = "administrador") => ({
  id,
  papel,
  publico() {
    return { nome: "Admin", papel };
  },
});
function authorize(t, papel = "administrador") {
  t.mock.method(User, "findById", () => ({
    select: async () => user(papel),
    then(resolve) {
      return Promise.resolve(user(papel)).then(resolve);
    },
  }));
}
const token = () => jwt.sign({ id }, secret, { expiresIn: "1h" });
async function post(path, body, headers = {}) {
  return fetch(`${base}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("Entrada exige administrador atual e valida o identificador antes da escrita", async (t) => {
  authorize(t, "comprador");
  assert.equal((await post("/admin/backoffice/codes", { state })).status, 401);
  assert.equal(
    (
      await post(
        "/admin/backoffice/codes",
        { state },
        { Authorization: `Bearer ${token()}` },
      )
    ).status,
    403,
  );
});
test("Um código emitido antes da redefinição não pode iniciar sessão", async (t) => {
  t.mock.method(BackofficeCode, "findOneAndDelete", async () => ({
    userId: id,
    tokenExpiresAt: Math.floor(Date.now() / 1000) + 60,
  }));
  t.mock.method(User, "findById", () => ({
    select: async () => ({ ...user(), sessionVersion: 1 }),
  }));
  const result = await post(
    "/internal/backoffice/exchange",
    { code: "c".repeat(64), state },
    { "X-Backoffice-Secret": integration },
  );
  assert.equal(result.status, 401);
});

test("Código guardado apenas como hash e JWT trocado conserva a expiração original", async (t) => {
  authorize(t);
  let entry;
  t.mock.method(BackofficeCode, "create", async (data) => {
    entry = data;
  });
  const original = token();
  const response = await post(
    "/admin/backoffice/codes",
    { state },
    { Authorization: `Bearer ${original}` },
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { code } = await response.json();
  assert.notEqual(entry.hash, code);
  assert.equal(entry.hash, hashCode(code));
  assert.ok(entry.expiresAt.getTime() <= Date.now() + 60000);
  t.mock.method(BackofficeCode, "findOneAndDelete", async (filter) => {
    assert.equal(filter.hash, hashCode(code));
    if (
      !entry ||
      filter.state !== entry.state ||
      entry.expiresAt <= filter.expiresAt.$gt ||
      entry.tokenExpiresAt <= filter.tokenExpiresAt.$gt
    )
      return null;
    const result = entry;
    entry = null;
    return result;
  });
  const headers = { "X-Backoffice-Secret": integration };
  assert.equal(
    (
      await post(
        "/internal/backoffice/exchange",
        { code, state: "b".repeat(64) },
        headers,
      )
    ).status,
    401,
  );
  const exchanged = await post(
    "/internal/backoffice/exchange",
    { code, state },
    headers,
  );
  assert.equal(exchanged.status, 200);
  const data = await exchanged.json();
  assert.equal(
    jwt.verify(data.token, secret).exp,
    jwt.verify(original, secret).exp,
  );
  assert.equal(
    (await post("/internal/backoffice/exchange", { code, state }, headers))
      .status,
    401,
  );
});
test("Troca recusa segredo incorreto e códigos inválidos ou expirados", async (t) => {
  t.mock.method(BackofficeCode, "findOneAndDelete", async () => null);
  const code = "c".repeat(64);
  assert.equal(
    (
      await post(
        "/internal/backoffice/exchange",
        { code, state },
        { "X-Backoffice-Secret": "wrong" },
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await post(
        "/internal/backoffice/exchange",
        { code: "invalid", state },
        { "X-Backoffice-Secret": integration },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/internal/backoffice/exchange",
        { code, state },
        { "X-Backoffice-Secret": integration },
      )
    ).status,
    401,
  );
});
test("Uma conta removida ou com papel alterado não recebe autenticação Laravel", async (t) => {
  t.mock.method(BackofficeCode, "findOneAndDelete", async () => ({
    userId: id,
    tokenExpiresAt: Math.floor(Date.now() / 1000) + 60,
  }));
  t.mock.method(User, "findById", () => ({
    select: async () => user("comprador"),
  }));
  assert.equal(
    (
      await post(
        "/internal/backoffice/exchange",
        { code: "c".repeat(64), state },
        { "X-Backoffice-Secret": integration },
      )
    ).status,
    403,
  );
});
test("Diagnóstico administrativo não é acessível a compradores ou visitantes", async (t) => {
  authorize(t, "comprador");
  assert.equal((await fetch(`${base}/api/admin/services`)).status, 401);
  assert.equal(
    (
      await fetch(`${base}/api/admin/services`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
    ).status,
    403,
  );
});
test("Diagnóstico real Socket.io confirma resposta sem entrar em salas de leilão", async () => {
  const http = createServer();
  const io = new Server(http, { transports: ["websocket"] });
  registerSockets(io);
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  try {
    await checkSocket(`http://127.0.0.1:${http.address().port}`);
    assert.equal(
      [...io.sockets.adapter.rooms.keys()].some((key) =>
        key.startsWith("leilao:"),
      ),
      false,
    );
  } finally {
    await new Promise((resolve) => io.close(resolve));
  }
});
test("Resultados não expõem detalhes internos da falha", async () => {
  assert.equal((await timedCheck("mongodb", async () => {})).status, "ok");
  const result = await timedCheck("mongodb", async () => {
    throw new Error("private password");
  });
  assert.equal(result.status, "failure");
  assert.doesNotMatch(result.message, /private|password/);
});

test("Diagnóstico rejeita uma confirmação Socket.io incorreta", async () => {
  const http = createServer();
  const io = new Server(http, { transports: ["websocket"] });
  io.on("connection", (socket) =>
    socket.on("diagnostico", (_nonce, reply) => reply("incorrect")),
  );
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  try {
    await assert.rejects(
      checkSocket(`http://127.0.0.1:${http.address().port}`),
    );
  } finally {
    await new Promise((resolve) => io.close(resolve));
  }
});

test("Verificações terminam ao fim de cinco segundos mesmo sem resposta", async () => {
  const start = performance.now();
  const result = await timedCheck("mongodb", () => new Promise(() => {}));
  assert.equal(result.status, "failure");
  assert.ok(performance.now() - start >= 4900);
  assert.ok(performance.now() - start < 6500);
});
