import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Auction from "../src/models/Auction.js";
import Bid from "../src/models/Bid.js";
import Product from "../src/models/Product.js";
import {
  emitAuctionTransition,
  registerSockets,
} from "../src/sockets/index.js";

const secret = "socket-test-secret-with-at-least-32-characters";
const buyer1 = "dca000000000000000000002";
const buyer2 = "dca000000000000000000003";
const producer = "dca000000000000000000004";
const lotId = "dca000000000000000000301";
const otherId = "dca000000000000000000302";

function setup(t) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  const now = Date.now();
  const auctions = new Map(
    [lotId, otherId].map((id) => [
      id,
      {
        _id: id,
        produtorId: { _id: producer, nome: "Horta" },
        produtos: [
          {
            produtoId: {
              _id: "dca000000000000000000101",
              produtorId: producer,
              nome: "Batata",
            },
            quantidade: 2,
            unidade: "kg",
          },
        ],
        lote: "Lote",
        precoBase: 100,
        incremento: 10,
        estado: "ativo",
        reservaStock: "reservada",
        dataInicio: new Date(now - 1000),
        dataFim: new Date(now + 60000),
        licitacaoAtual: { valor: 100, compradorId: null },
      },
    ]),
  );
  const bids = [];
  const users = new Map([
    [buyer1, { _id: buyer1, nome: "Ana", papel: "comprador" }],
    [buyer2, { _id: buyer2, nome: "Bia", papel: "comprador" }],
    [producer, { _id: producer, nome: "Horta", papel: "produtor" }],
  ]);
  const query = (get) => ({
    select() {
      return this;
    },
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    async lean() {
      return structuredClone(get());
    },
    then(resolve, reject) {
      return this.lean().then(resolve, reject);
    },
  });
  t.mock.method(User, "findById", (id) =>
    query(() => users.get(String(id)) ?? null),
  );
  t.mock.method(User, "findOne", (filter) =>
    query(() =>
      users.get(String(filter._id))?.papel === filter.papel
        ? users.get(String(filter._id))
        : null,
    ),
  );
  t.mock.method(Auction, "findById", (id) =>
    query(() => auctions.get(String(id)) ?? null),
  );
  t.mock.method(
    Product,
    "findOneAndUpdate",
    async (filter, _update, options) => {
      assert.deepEqual(filter.bloqueado, { $ne: true });
      assert.ok(options.session);
      return { _id: filter._id };
    },
  );
  t.mock.method(Bid, "find", (filter) =>
    query(() =>
      bids
        .filter((item) => item.leilaoId === filter.leilaoId)
        .map((item) => ({
          ...item,
          compradorId: {
            _id: item.compradorId,
            nome: users.get(item.compradorId).nome,
          },
        })),
    ),
  );
  t.mock.method(Bid, "findOne", (filter) =>
    query(
      () =>
        bids
          .filter(
            (item) =>
              item.leilaoId === filter.leilaoId &&
              item.compradorId === filter.compradorId,
          )
          .at(-1) ?? null,
    ),
  );
  const emissions = [];
  const rooms = new Map();
  const io = {
    sockets: { adapter: { rooms } },
    use(handler) {
      this.middleware = handler;
    },
    on(_name, handler) {
      this.connection = handler;
    },
    to(name) {
      return {
        emit(event, payload) {
          emissions.push({ room: name, event, payload });
        },
      };
    },
  };
  registerSockets(io);
  const token = (id) => jwt.sign({ id }, secret, { expiresIn: "1h" });
  async function connect(id) {
    const handlers = new Map();
    const socket = {
      data: {},
      rooms: new Set(),
      handshake: {
        auth: id ? { token: id.startsWith("bad") ? id : token(id) } : {},
      },
      on(name, handler) {
        handlers.set(name, handler);
      },
      emit(name, payload) {
        this.sent.push({ name, payload });
      },
      sent: [],
      join(name) {
        this.rooms.add(name);
        if (!rooms.has(name)) rooms.set(name, new Set());
        rooms.get(name).add(this);
      },
      leave(name) {
        this.rooms.delete(name);
        rooms.get(name)?.delete(this);
        if (!rooms.get(name)?.size) rooms.delete(name);
      },
      disconnect() {
        handlers.get("disconnecting")?.();
        for (const name of [...this.rooms]) this.leave(name);
        handlers.get("disconnect")?.();
      },
      async trigger(name, ...args) {
        return handlers.get(name)?.(...args);
      },
    };
    const error = await new Promise((resolve) =>
      io.middleware(socket, resolve),
    );
    if (error) return { error };
    io.connection(socket);
    t.after(() => socket.disconnect());
    return socket;
  }
  return { io, emissions, auctions, bids, users, token, connect };
}

test("Confirmações inválidas não interrompem os eventos de leilão", async (t) => {
  const { connect, bids, emissions } = setup(t);
  const guest = await connect();
  const invalid = [undefined, null, "texto", 42, false, {}, []];

  for (const ack of invalid) {
    await guest.trigger("entrar", lotId, ack);
    assert.ok(guest.rooms.has(`leilao:${lotId}`));
    assert.equal(guest.sent.at(-1).name, "estado");
    await guest.trigger("entrar", "invalid", ack);
    await guest.trigger("licitar", { leilaoId: lotId, valor: 110 }, ack);
  }
  assert.equal(bids.length, 0);
  assert.equal(
    emissions.filter((item) => item.event === "nova-licitacao").length,
    0,
  );

  t.mock.method(Bid, "find", () => {
    throw new Error("Falha na consulta");
  });
  await guest.trigger("entrar", lotId, {});
  const answers = [];
  await guest.trigger("entrar", lotId, (answer) => answers.push(answer));
  assert.deepEqual(answers, [
    { ok: false, erro: "Não foi possível entrar no leilão." },
  ]);
});

test("Licitações com confirmação inválida preservam sucesso e falha", async (t) => {
  const { connect, auctions, bids, emissions } = setup(t);
  const buyer = await connect(buyer1);
  await buyer.trigger("entrar", lotId, {});
  t.mock.method(mongoose, "startSession", async () => ({
    async withTransaction(fn) {
      await fn();
    },
    async endSession() {},
  }));
  t.mock.method(Auction, "findOneAndUpdate", async (filter, update) => {
    auctions.get(filter._id).licitacaoAtual = update.$set.licitacaoAtual;
    return auctions.get(filter._id);
  });
  t.mock.method(Bid, "create", async ([record]) => {
    const bid = { ...record, _id: "bid-1", createdAt: new Date() };
    bids.push(bid);
    return [bid];
  });
  await buyer.trigger("licitar", { leilaoId: lotId, valor: 110 }, {});
  assert.equal(bids.length, 1);
  assert.equal(auctions.get(lotId).licitacaoAtual.valor, 110);
  assert.equal(
    emissions.filter((item) => item.event === "nova-licitacao").length,
    1,
  );
  t.mock.method(Product, "findOneAndUpdate", async () => {
    throw new Error("Falha");
  });
  await buyer.trigger("licitar", { leilaoId: lotId, valor: 120 }, []);
  const answers = [];
  await buyer.trigger("licitar", { leilaoId: lotId, valor: 120 }, (answer) =>
    answers.push(answer),
  );
  assert.deepEqual(answers, [
    {
      ok: false,
      erro: "Não foi possível confirmar a licitação. Consulte o histórico antes de tentar novamente.",
    },
  ]);
  assert.equal(bids.length, 1);
  assert.equal(
    emissions.filter((item) => item.event === "nova-licitacao").length,
    1,
  );
});

test("Visitante assiste à sala pública; JWT inválido não obtém sala privada", async (t) => {
  const { connect, emissions, auctions } = setup(t);
  const guest = await connect();
  const producerSocket = await connect(producer);
  const invalid = await connect("bad-token");
  assert.match(invalid.error.message, /Autenticação/);
  assert.ok(producerSocket.rooms.has(`user:${producer}`));
  let answer;
  await guest.trigger("entrar", lotId, (value) => {
    answer = value;
  });
  assert.equal(answer.ok, true);
  assert.equal(
    guest.sent.find((item) => item.name === "estado").payload.leilao._id,
    lotId,
  );
  assert.ok(
    emissions.some(
      (item) =>
        item.room === `leilao:${lotId}` &&
        item.event === "presenca" &&
        item.payload === 1,
    ),
  );
  await guest.trigger("licitar", { leilaoId: lotId, valor: 110 }, (value) => {
    answer = value;
  });
  assert.equal(answer.ok, false);
  await producerSocket.trigger(
    "licitar",
    { leilaoId: lotId, valor: 110 },
    (value) => {
      answer = value;
    },
  );
  assert.equal(answer.ok, false);
  assert.equal(auctions.get(lotId).licitacaoAtual.valor, 100);
  await guest.trigger("entrar", "invalid", (value) => {
    answer = value;
  });
  assert.equal(answer.ok, false);
  guest.disconnect();
  assert.ok(
    emissions.some(
      (item) =>
        item.room === `leilao:${lotId}` &&
        item.event === "presenca" &&
        item.payload === 0,
    ),
  );
});

test("IDs de leilão com capitalização diferente partilham sala, presença e transições", async (t) => {
  const { connect, emissions, io } = setup(t);
  const lower = await connect();
  const upper = await connect();
  await lower.trigger("entrar", lotId, () => {});
  await upper.trigger("entrar", lotId.toUpperCase(), () => {});
  assert.ok(lower.rooms.has(`leilao:${lotId}`));
  assert.ok(upper.rooms.has(`leilao:${lotId}`));
  assert.ok(
    emissions.some(
      (item) =>
        item.room === `leilao:${lotId}` &&
        item.event === "presenca" &&
        item.payload === 2,
    ),
  );
  await upper.trigger("sair", lotId);
  assert.ok(
    emissions.some(
      (item) =>
        item.room === `leilao:${lotId}` &&
        item.event === "presenca" &&
        item.payload === 1,
    ),
  );
  emitAuctionTransition(io, { id: lotId.toUpperCase(), estado: "ativo" });
  assert.ok(
    emissions.some(
      (item) => item.room === `leilao:${lotId}` && item.event === "aberto",
    ),
  );
});

test("Dois lances iguais aceitam apenas um; falha de escrita não gera broadcast", async (t) => {
  const { connect, auctions, bids, emissions } = setup(t);
  const first = await connect(buyer1);
  const second = await connect(buyer2);
  await first.trigger("entrar", lotId, () => {});
  await second.trigger("entrar", lotId, () => {});
  let queue = Promise.resolve();
  t.mock.method(mongoose, "startSession", async () => ({
    async withTransaction(fn) {
      const previous = queue;
      let release;
      queue = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      const snapshot = structuredClone(auctions.get(lotId));
      try {
        await fn();
      } catch (error) {
        auctions.set(lotId, snapshot);
        throw error;
      } finally {
        release();
      }
    },
    async endSession() {},
  }));
  t.mock.method(
    Auction,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.ok(options.session);
      const current = auctions.get(filter._id);
      if (
        current.estado !== filter.estado ||
        current.reservaStock !== filter.reservaStock ||
        current.licitacaoAtual.valor > filter["licitacaoAtual.valor"].$lte
      )
        return null;
      current.licitacaoAtual = update.$set.licitacaoAtual;
      return current;
    },
  );
  t.mock.method(Bid, "create", async ([record], options) => {
    assert.ok(options.session);
    const bid = {
      ...record,
      _id: `bid-${bids.length + 1}`,
      createdAt: new Date(),
    };
    bids.push(bid);
    return [bid];
  });
  const answers = [];
  await Promise.all([
    first.trigger("licitar", { leilaoId: lotId, valor: 110 }, (value) =>
      answers.push(value),
    ),
    second.trigger("licitar", { leilaoId: lotId, valor: 110 }, (value) =>
      answers.push(value),
    ),
  ]);
  assert.deepEqual(answers.map((item) => item.ok).sort(), [false, true]);
  assert.equal(bids.length, 1);
  assert.equal(auctions.get(lotId).licitacaoAtual.valor, 110);
  assert.equal(
    emissions.filter((item) => item.event === "nova-licitacao").length,
    1,
  );
  await first.trigger("entrar", lotId, () => {});
  assert.equal(first.sent.at(-1).payload?.ultimaLicitacaoPropria?.valor, 110);
  t.mock.method(Bid, "create", async () => {
    throw new Error("Falha simulada");
  });
  await first.trigger("licitar", { leilaoId: lotId, valor: 120 }, (value) =>
    answers.push(value),
  );
  assert.equal(answers.at(-1).ok, false);
  assert.equal(auctions.get(lotId).licitacaoAtual.valor, 110);
  assert.equal(
    emissions.filter((item) => item.event === "nova-licitacao").length,
    1,
  );
});

test("Ocultação confirmada depois de entrar na sala impede o lance dentro da transação", async (t) => {
  const { connect, emissions, bids } = setup(t);
  const buyer = await connect(buyer1);
  await buyer.trigger("entrar", lotId, () => {});
  t.mock.method(mongoose, "startSession", async () => ({
    async withTransaction(fn) {
      await fn();
    },
    async endSession() {},
  }));
  t.mock.method(Product, "findOneAndUpdate", async (filter) => {
    assert.deepEqual(filter.bloqueado, { $ne: true });
    return null;
  });
  t.mock.method(Auction, "findOneAndUpdate", () => {
    throw new Error("Não deve atualizar o leilão.");
  });
  let answer;
  await buyer.trigger("licitar", { leilaoId: lotId, valor: 110 }, (value) => {
    answer = value;
  });
  assert.equal(answer.ok, false);
  assert.equal(bids.length, 0);
  assert.equal(
    emissions.filter((item) => item.event === "nova-licitacao").length,
    0,
  );
});
