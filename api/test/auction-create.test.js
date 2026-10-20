import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import router from '../src/routes/auctions.js';
import Auction from '../src/models/Auction.js';
import Product from '../src/models/Product.js';

const handler = router.stack.find(layer => layer.route?.methods.post).route.stack.at(-1).handle;
const now = Date.parse('2026-10-18T12:00:00Z');
let session;
beforeEach(t => {
  t.mock.method(Date, 'now', () => now);
  session = { committed: false, ended: false, async withTransaction(fn) { await fn(); this.committed = true; }, async endSession() { this.ended = true; } };
  t.mock.method(mongoose, 'startSession', async () => session);
});
const producerId = 'dca000000000000000000004';
const productId = 'dca000000000000000000065';
const body = {
  produtos: [{ produtoId: productId, quantidade: 10 }], lote: '10 kg', precoBase: 1000, incremento: 100,
  dataInicio: new Date(now).toISOString(), dataFim: new Date(now + 1000).toISOString(),
};

async function invoke(data) {
  const response = { code: 200, status(code) { this.code = code; return this; },
    location(value) { this.url = value; return this; }, json(value) { if (this.code === 201) assert.ok(session.committed); this.body = value; } };
  await handler({ body: data, user: { id: producerId } }, response, error => { if (error.status) { response.code = error.status; response.body = { erro: error.message }; } else throw error; });
  return response;
}

test('Criação valida corpo ausente e datas antes de consultar produtos', async t => {
  t.mock.method(Product, 'findOneAndUpdate', () => { throw new Error('Não consultar.'); });
  for (const data of [undefined, null, {}, ...[undefined, null, false, 0, [], {}, '', 'inválida']
    .flatMap(date => [{ ...body, dataInicio: date }, { ...body, dataFim: date }]),
    { ...body, dataFim: body.dataInicio }, { ...body, dataFim: new Date(now - 1).toISOString() }]) {
    assert.equal((await invoke(data)).code, 400);
  }
});

test('Criação usa um único instante e a mesma regra temporal das leituras', async t => {
  let time = now;
  t.mock.method(Date, 'now', () => time);
  t.mock.method(Product, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(update, { $inc: { revisaoLeiloes: 1 } });
    assert.equal(options.session, session);
    assert.equal(options.timestamps, false);
    assert.deepEqual(filter, { _id: productId, produtorId: producerId, publicado: true });
    time = now + 60_000;
    return { _id: productId, unidade: 'kg', stock: 10 };
  });
  t.mock.method(Auction, 'create', async ([data], options) => {
    assert.equal(options.session, session);
    const auction = new Auction(data);
    await auction.validate();
    auction.populate = async () => auction;
    return [auction];
  });
  for (const [changes, expected] of [
    [{ dataInicio: new Date(now + 1).toISOString() }, 'agendado'],
    [{}, 'agendado'],
  ]) {
    time = now;
    const response = await invoke({ ...body, ...changes, estado: 'ativo', reservaStock: 'reservada', unidade: 'l' });
    assert.equal(response.code, 201);
    assert.equal(response.body.estado, expected);
    assert.equal(response.body.reservaStock, 'pendente');
    assert.equal(response.body.produtos[0].unidade, 'kg');
    assert.equal(response.body.produtorId.toString(), producerId);
    assert.equal(response.body.licitacaoAtual.valor, body.precoBase);
    assert.equal(response.url, `/api/auctions/${response.body.id}`);
  }
});

test('Criação continua a recusar produto indisponível e quantidades inválidas', async t => {
  const product = t.mock.method(Product, 'findOneAndUpdate', async () => null);
  assert.equal((await invoke(body)).code, 404);
  product.mock.mockImplementation(async () => ({ _id: productId, unidade: 'kg', stock: 10 }));
  t.mock.method(Auction, 'create', () => { throw new Error('Não criar.'); });
  for (const quantidade of [0, -1, 11, '1', null, NaN, Infinity]) {
    assert.equal((await invoke({ ...body, produtos: [{ produtoId: productId, quantidade }] })).code, 400);
  }
});

test('Cria lote misto na ordem pedida e obtém unidades do servidor', async t => {
  const secondId = 'dca000000000000000000067';
  t.mock.method(Product, 'findOneAndUpdate', async filter => {
    assert.equal(filter.produtorId, producerId);
    return filter._id === secondId ? { _id: secondId, unidade: 'unidade', stock: 3 } : { _id: productId, unidade: 'kg', stock: 10 };
  });
  t.mock.method(Auction, 'create', async ([data], options) => {
    assert.equal(options.session, session);
    const auction = new Auction(data);
    await auction.validate();
    auction.populate = async path => { assert.equal(path, 'produtos.produtoId'); };
    return [auction];
  });
  const response = await invoke({ ...body, produtos: [
    { produtoId: productId.toUpperCase(), quantidade: 1.5, unidade: 'l' },
    { produtoId: secondId, quantidade: 2, unidade: 'g' },
  ] });
  assert.equal(response.code, 201);
  assert.deepEqual(response.body.produtos.map(line => line.toObject()), [
    { produtoId: response.body.produtos[0].produtoId, quantidade: 1.5, unidade: 'kg' },
    { produtoId: response.body.produtos[1].produtoId, quantidade: 2, unidade: 'unidade' },
  ]);
  assert.equal(response.body.precoBase, body.precoBase);
  assert.equal(response.body.produtoId, undefined);
  assert.equal(response.body.quantidade, undefined);
  assert.equal(response.body.unidade, undefined);
});

test('Lista obrigatória rejeita duplicados normalizados e linhas inválidas sem consultar produtos', async t => {
  t.mock.method(Product, 'findOneAndUpdate', () => { throw new Error('Não consultar.'); });
  t.mock.method(Auction, 'create', () => { throw new Error('Não criar.'); });
  for (const produtos of [undefined, null, {}, [], [null], [{}],
    [{ produtoId: 'inválido', quantidade: 1 }],
    [{ produtoId: productId, quantidade: 1 }, { produtoId: productId.toUpperCase(), quantidade: 2 }]]) {
    assert.equal((await invoke({ ...body, produtos })).code, 400);
  }
});

test('Um produto indisponível impede a criação de todo o lote', async t => {
  t.mock.method(Product, 'findOneAndUpdate', async filter => {
    assert.equal(filter.produtorId, producerId);
    assert.equal(filter.publicado, true);
    return filter._id === productId ? { _id: productId, unidade: 'kg', stock: 10 } : null;
  });
  t.mock.method(Auction, 'create', () => { throw new Error('Não criar parcialmente.'); });
  assert.equal((await invoke({ ...body, produtos: [
    { produtoId: productId, quantidade: 1 }, { produtoId: 'dca000000000000000000067', quantidade: 1 },
  ] })).code, 404);
});

test('Bloqueia produtos por ID e mantém a ordem original das linhas', async t => {
  const secondId = 'dca000000000000000000067';
  const locked = [];
  t.mock.method(Product, 'findOneAndUpdate', async filter => {
    locked.push(filter._id);
    return { _id: filter._id, stock: 10, unidade: 'kg' };
  });
  t.mock.method(Auction, 'create', async ([data], options) => {
    assert.equal(options.session, session);
    const auction = new Auction(data);
    auction.populate = async () => auction;
    return [auction];
  });
  const response = await invoke({ ...body, produtos: [{ produtoId: secondId, quantidade: 1 }, { produtoId: productId, quantidade: 2 }] });
  assert.deepEqual(locked, [productId, secondId]);
  assert.deepEqual(response.body.produtos.map(line => String(line.produtoId)), [secondId, productId]);
  assert.ok(session.ended);
});

test('Falha na última linha reverte as revisões e não cria um leilão parcial', async t => {
  const secondId = 'dca000000000000000000067';
  const records = [{ _id: productId, stock: 10, unidade: 'kg', revisaoLeiloes: 0, updatedAt: new Date(0) },
    { _id: secondId, stock: 1, unidade: 'kg', revisaoLeiloes: 0, updatedAt: new Date(0) }];
  const before = structuredClone(records);
  session.withTransaction = async fn => {
    try { await fn(); session.committed = true; }
    catch (error) { records.forEach((record, index) => Object.assign(record, before[index])); throw error; }
  };
  t.mock.method(Product, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(options.session, session);
    assert.equal(options.timestamps, false);
    const record = records.find(product => product._id === filter._id);
    record.revisaoLeiloes += update.$inc.revisaoLeiloes;
    return record;
  });
  const create = t.mock.method(Auction, 'create', () => { throw new Error('Não criar.'); });
  assert.equal((await invoke({ ...body, produtos: [{ produtoId: productId, quantidade: 1 }, { produtoId: secondId, quantidade: 2 }] })).code, 400);
  assert.deepEqual(records, before);
  assert.equal(create.mock.callCount(), 0);
  assert.ok(session.ended);
  assert.equal(session.committed, false);
});
