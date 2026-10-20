import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Auction, Product, User, Bid } from '../src/models/index.js';
import { processAuctionStock, processAuctionsStock, scheduleAuctionsStock } from '../src/services/auctionStock.js';
import { cleanupBrunoAuction } from '../src/scripts/cleanup-bruno.js';

const now = Date.parse('2026-10-18T12:00:00Z');
const producerId = 'producer';
const lot = (id = 'a') => ({
  _id: id, produtorId: producerId, estado: 'agendado', reservaStock: 'pendente', lote: 'BRUNO_AUTOTEST_lote',
  dataInicio: new Date(now - 1000), dataFim: new Date(now + 1000),
  produtos: [{ produtoId: 'p1', quantidade: 6, unidade: 'kg' }, { produtoId: 'p2', quantidade: 2, unidade: 'l' }],
  licitacaoAtual: { valor: 100, compradorId: null },
});
function matches(record, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(branch => matches(record, branch));
    const actual = record[key];
    if (value instanceof RegExp) return value.test(actual);
    if (!value || typeof value !== 'object' || value instanceof Date) return String(actual) === String(value);
    return Object.entries(value).every(([op, expected]) => {
      if (op === '$in') return expected.includes(actual);
      if (op === '$lte') return actual <= expected;
      if (op === '$gt') return actual > expected;
      if (op === '$gte') return actual >= expected;
      throw new Error(`Operador inesperado: ${op}`);
    });
  });
}

function fixture(t, auctions = [lot()]) {
  const db = { auctions: structuredClone(auctions), products: [
    { _id: 'p1', produtorId: producerId, publicado: true, unidade: 'kg', stock: 10 },
    { _id: 'p2', produtorId: producerId, publicado: true, unidade: 'l', stock: 3 },
  ], approved: true };
  let queue = Promise.resolve();
  const query = get => ({
    session() { return this; }, select() { return this; },
    sort(fields) { this.sortFields = fields; return this; },
    async lean() {
      const result = structuredClone(get());
      if (Array.isArray(result) && this.sortFields) result.sort((a, b) => {
        for (const key of Object.keys(this.sortFields)) {
          if (a[key] < b[key]) return -1;
          if (a[key] > b[key]) return 1;
        }
        return 0;
      });
      return result;
    },
    then(resolve, reject) { return this.lean().then(resolve, reject); },
  });
  t.mock.method(mongoose, 'startSession', async () => ({
    async withTransaction(fn) {
      const previous = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await previous;
      const snapshot = structuredClone(db);
      try { return await fn(); } catch (error) { Object.assign(db, snapshot); throw error; } finally { release(); }
    },
    async endSession() {},
  }));
  t.mock.method(Auction, 'findById', id => query(() => db.auctions.find(a => a._id === id) ?? null));
  t.mock.method(Auction, 'findOne', filter => query(() => db.auctions.find(a => matches(a, filter)) ?? null));
  t.mock.method(Auction, 'find', filter => query(() => db.auctions.filter(a => matches(a, filter))));
  t.mock.method(Auction, 'updateOne', async (filter, update) => {
    const record = db.auctions.find(a => matches(a, filter));
    if (!record) return { modifiedCount: 0 };
    Object.assign(record, update.$set);
    return { modifiedCount: 1 };
  });
  t.mock.method(Auction, 'deleteOne', async filter => {
    const index = db.auctions.findIndex(a => matches(a, filter));
    if (index < 0) return { deletedCount: 0 };
    db.auctions.splice(index, 1);
    return { deletedCount: 1 };
  });
  t.mock.method(User, 'findOne', () => query(() => db.approved ? { _id: producerId } : null));
  t.mock.method(Product, 'find', filter => query(() => db.products.filter(p => matches(p, filter))));
  t.mock.method(Product, 'updateOne', async (filter, update, options) => {
    assert.ok(options.session);
    const record = db.products.find(p => matches(p, filter));
    if (!record) return { modifiedCount: 0, matchedCount: 0 };
    record.stock += update.$inc.stock;
    return { modifiedCount: 1, matchedCount: 1 };
  });
  t.mock.method(Bid, 'deleteMany', async () => {});
  return db;
}

test('Reserva todo o lote uma vez, incluindo execução concorrente e repetida', async t => {
  const db = fixture(t);
  await Promise.all([processAuctionStock('a', now), processAuctionStock('a', now)]);
  assert.deepEqual(db.products.map(p => p.stock), [4, 1]);
  assert.equal(db.auctions[0].estado, 'ativo');
  assert.equal(db.auctions[0].reservaStock, 'reservada');
  await processAuctionStock('a', now);
  assert.deepEqual(db.products.map(p => p.stock), [4, 1]);
});

test('Stock insuficiente no segundo produto cancela sem descontos parciais', async t => {
  const db = fixture(t);
  db.products[1].stock = 1;
  await processAuctionStock('a', now);
  assert.deepEqual(db.products.map(p => p.stock), [10, 1]);
  assert.equal(db.auctions[0].motivoCancelamento, 'stock-insuficiente');
  assert.equal(db.auctions[0].estado, 'cancelado');
  await processAuctionStock('a', now + 2000);
  assert.deepEqual(db.products.map(p => p.stock), [10, 1]);
});

for (const change of ['removed', 'private', 'owner', 'unit', 'producer']) {
  test(`Revalida disponibilidade ao iniciar: ${change}`, async t => {
    const db = fixture(t);
    if (change === 'removed') db.products.pop();
    if (change === 'private') db.products[1].publicado = false;
    if (change === 'owner') db.products[1].produtorId = 'other';
    if (change === 'unit') db.products[1].unidade = 'g';
    if (change === 'producer') db.approved = false;
    const stocks = db.products.map(p => p.stock);
    await processAuctionStock('a', now);
    assert.equal(db.auctions[0].estado, 'cancelado');
    assert.equal(db.auctions[0].motivoCancelamento, change === 'producer' ? 'produtor-indisponivel' : 'produto-indisponivel');
    assert.deepEqual(db.products.map(p => p.stock), stocks);
  });
}

test('Falha técnica depois do primeiro desconto aborta tudo e permite nova tentativa', async t => {
  const db = fixture(t);
  const update = Product.updateOne;
  t.mock.method(Product, 'updateOne', async (...args) => {
    if (args[0]._id === 'p2') throw new Error('Falha simulada.');
    return update(...args);
  });
  await assert.rejects(processAuctionStock('a', now), /Falha simulada/);
  assert.deepEqual(db.products.map(p => p.stock), [10, 3]);
  assert.equal(db.auctions[0].reservaStock, 'pendente');
  t.mock.method(Product, 'updateOne', update);
  await processAuctionStock('a', now);
  assert.equal(db.auctions[0].reservaStock, 'reservada');
});

test('Fim sem vencedor devolve stock uma única vez, mesmo se os produtos estiverem ocultos', async t => {
  const db = fixture(t);
  await processAuctionStock('a', now);
  db.products[0].publicado = false;
  await Promise.all([processAuctionStock('a', now + 1000), processAuctionStock('a', now + 1000)]);
  assert.deepEqual(db.products.map(p => p.stock), [10, 3]);
  assert.equal(db.auctions[0].reservaStock, 'libertada');
});

test('Fim com vencedor mantém quantidades atribuídas sem segundo desconto', async t => {
  const db = fixture(t);
  await processAuctionStock('a', now);
  db.auctions[0].licitacaoAtual.compradorId = 'buyer';
  await processAuctionStock('a', now + 1000);
  await processAuctionStock('a', now + 2000);
  assert.deepEqual(db.products.map(p => p.stock), [4, 1]);
  assert.equal(db.auctions[0].reservaStock, 'atribuida');
});

test('Reinício antes do início ou depois de perder todo o intervalo não desconta stock', async t => {
  const db = fixture(t);
  await processAuctionStock('a', now - 2000);
  assert.equal(db.auctions[0].reservaStock, 'pendente');
  await processAuctionStock('a', now + 1000);
  assert.equal(db.auctions[0].reservaStock, 'sem-reserva');
  assert.deepEqual(db.products.map(p => p.stock), [10, 3]);
});

test('Processa finais antes de inícios e ordena lotes concorrentes pela data e ID', async t => {
  const ended = { ...lot('ended'), estado: 'ativo', reservaStock: 'reservada', dataFim: new Date(now) };
  const db = fixture(t, [lot('b'), ended, lot('a')]);
  db.products[0].stock = 4; db.products[1].stock = 1;
  await processAuctionsStock(now);
  assert.equal(db.auctions.find(a => a._id === 'ended').reservaStock, 'libertada');
  assert.equal(db.auctions.find(a => a._id === 'a').reservaStock, 'reservada');
  assert.equal(db.auctions.find(a => a._id === 'b').estado, 'cancelado');
  assert.deepEqual(db.products.map(p => p.stock), [4, 1]);
});

test('Limpeza Bruno só restitui reservas efetivas e é repetível', async t => {
  const db = fixture(t, [lot('pending'), { ...lot('history'), estado: 'terminado', reservaStock: 'sem-reserva' }, lot('reserved')]);
  await processAuctionStock('reserved', now);
  for (const id of ['pending', 'history']) await cleanupBrunoAuction(id);
  assert.deepEqual(db.products.map(p => p.stock), [4, 1]);
  await cleanupBrunoAuction('reserved');
  await cleanupBrunoAuction('reserved');
  assert.deepEqual(db.products.map(p => p.stock), [10, 3]);
});

test('Agendador não sobrepõe ciclos e pode ser parado', async t => {
  const callbacks = [];
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => {
    assert.equal(delay, 5000);
    callbacks.push(fn);
    return { unref() {} };
  });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  t.mock.method(Auction, 'find', () => ({ sort() { return this; }, select() { return this; }, lean: () => pending }));
  const stop = scheduleAuctionsStock();
  const cycle = callbacks[0]();
  assert.equal(callbacks.length, 1);
  stop(); finish([]);
  await cycle;
  assert.equal(callbacks.length, 1);
});

test('Erro técnico num leilão não impede processar os restantes do ciclo', async t => {
  const db = fixture(t, [lot('a'), lot('b')]);
  const update = Product.updateOne;
  let fail = true;
  t.mock.method(Product, 'updateOne', async (...args) => {
    if (fail) { fail = false; throw new Error('Falha transitória.'); }
    return update(...args);
  });
  await assert.rejects(processAuctionsStock(now), { name: 'AggregateError' });
  assert.equal(db.auctions[0].reservaStock, 'pendente');
  assert.equal(db.auctions[1].reservaStock, 'reservada');
  assert.deepEqual(db.products.map(p => p.stock), [4, 1]);
});

test('Fim atingido durante validação não ativa nem desconta um lote expirado', async t => {
  const db = fixture(t);
  let time = now;
  t.mock.method(Date, 'now', () => time);
  const query = Product.find;
  t.mock.method(Product, 'find', (...args) => { time = now + 1000; return query(...args); });
  await processAuctionStock('a');
  assert.equal(db.auctions[0].reservaStock, 'sem-reserva');
  assert.deepEqual(db.products.map(p => p.stock), [10, 3]);
});

test('Limpeza de lote atribuído restitui a reserva de teste uma única vez', async t => {
  const db = fixture(t);
  await processAuctionStock('a', now);
  db.auctions[0].licitacaoAtual.compradorId = 'buyer';
  await processAuctionStock('a', now + 1000);
  await cleanupBrunoAuction('a');
  await cleanupBrunoAuction('a');
  assert.deepEqual(db.products.map(p => p.stock), [10, 3]);
});
