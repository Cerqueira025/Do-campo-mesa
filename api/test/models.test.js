import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { seedData, insertSeedData } from '../src/scripts/seed-data.js';
import { User, Product, Order, Auction, Bid, Review } from '../src/models/index.js';

const passwordHash = await bcrypt.hash('CampoMesaDemo123!', 4);
const fixtures = seedData(passwordHash, new Date('2026-10-15T12:00:00Z'));
const documentData = (model) => new model(fixtures.find(([candidate]) => candidate === model)[1][0]).toObject();

test('Todos os exemplos cumprem os schemas e as relações de negócio do seed', async () => {
  const records = new Map(fixtures.flatMap(([, documents]) => documents.map((document) => [String(document._id), document])));
  for (const [model, documents] of fixtures) {
    for (const data of documents) {
      await new model(data).validate();
      for (const key of ['produtorId', 'produtoId', 'compradorId', 'encomendaId', 'autorId', 'leilaoId']) {
        if (data[key]) assert.ok(records.has(String(data[key])), `${model.modelName}.${key}`);
      }
    }
  }
  for (const order of fixtures.find(([model]) => model === Order)[1]) {
    for (const line of order.linhas) {
      const product = records.get(String(line.produtoId));
      assert.equal(String(product.produtorId), String(order.produtorId));
    }
  }
  for (const review of fixtures.find(([model]) => model === Review)[1]) {
    const order = records.get(String(review.encomendaId));
    assert.equal(order.estado, 'entregue');
    assert.equal(String(order.compradorId), String(review.autorId));
    if (review.produtoId) assert.ok(order.linhas.some((line) => String(line.produtoId) === String(review.produtoId)));
    if (review.produtorId) assert.equal(String(order.produtorId), String(review.produtorId));
  }
  for (const auction of fixtures.find(([model]) => model === Auction)[1]) {
    const bids = fixtures.find(([model]) => model === Bid)[1]
      .filter((bid) => String(bid.leilaoId) === String(auction._id)).sort((a, b) => b.valor - a.valor);
    if (!bids.length) {
      assert.equal(auction.licitacaoAtual.valor, auction.precoBase);
      assert.equal(auction.licitacaoAtual.compradorId, null);
    } else {
      assert.equal(auction.licitacaoAtual.valor, bids[0].valor);
      assert.equal(String(auction.licitacaoAtual.compradorId), String(bids[0].compradorId));
      const chronological = [...bids].sort((a, b) => a.createdAt - b.createdAt);
      let previous = auction.precoBase;
      for (const bid of chronological) {
        assert.ok(bid.valor >= previous + auction.incremento);
        assert.ok(bid.createdAt > auction.dataInicio && bid.createdAt < auction.dataFim);
        previous = bid.valor;
      }
    }
  }
});

test('Password com hash bcrypt e campo excluído por defeito das consultas', async () => {
  assert.ok(await bcrypt.compare('CampoMesaDemo123!', passwordHash));
  assert.equal(User.schema.path('passwordHash').options.select, false);
  await assert.rejects(new User({ ...documentData(User), passwordHash: 'password-em-claro' }).validate());
});

test('Rejeita estados, preços e quantidades inválidos', async () => {
  const cases = [
    [User, { papel: 'visitante' }],
    [Product, { preco: -1 }], [Product, { preco: 1.5 }], [Product, { stock: -1 }],
    [Order, { estado: 'desconhecido' }], [Order, { linhas: [] }], [Order, { total: 1 }],
    [Auction, { estado: 'desconhecido' }], [Auction, { incremento: 0 }],
    [Auction, { quantidade: 0 }], [Auction, { dataFim: new Date(0) }],
    [Bid, { valor: -1 }], [Review, { classificacao: 6 }], [Review, { classificacao: 2.5 }],
  ];
  for (const [model, changes] of cases) {
    await assert.rejects(new model({ ...documentData(model), ...changes }).validate(), { name: 'ValidationError' });
  }
});

test('Exige perfil de produtor, morada de entrega e um único alvo na avaliação', async () => {
  const producer = new User(fixtures.find(([model]) => model === User)[1][3]).toObject();
  await assert.rejects(new User({ ...producer, perfilProdutor: undefined }).validate());
  await assert.rejects(new User({ ...producer, papel: 'comprador' }).validate());
  await assert.rejects(new Order({ ...documentData(Order), entrega: { tipo: 'entrega' } }).validate());
  await assert.rejects(new Review({ ...documentData(Review), produtoId: undefined }).validate());
  await assert.rejects(new Review({ ...documentData(Review), produtorId: producer._id }).validate());
});

test('IDs do seed permanecem estáveis mesmo quando as datas mudam', () => {
  const other = seedData(passwordHash, new Date(0));
  assert.deepEqual(fixtures.map(([, data]) => data.map((row) => String(row._id))),
    other.map(([, data]) => data.map((row) => String(row._id))));
});

test('Seed repetido preserva documentos e timestamps existentes', async (t) => {
  const collections = new Map();
  for (const [model] of fixtures) {
    const stored = new Map();
    t.mock.method(model, 'createCollection', async () => {});
    t.mock.method(model, 'createIndexes', async () => {});
    t.mock.method(model, 'find', (filter) => ({ select: () => ({ lean: async () => [...stored.values()]
      .filter((row) => filter.email ? filter.email.$in.includes(row.email) : filter._id.$in.some((id) => String(id) === String(row._id))) }) }));
    collections.set(model.collection.name, stored);
    t.mock.method(model.collection, 'updateOne', async (filter, update, options) => {
      assert.equal(options.upsert, true);
      assert.deepEqual(Object.keys(update), ['$setOnInsert']);
      const key = String(filter._id);
      if (stored.has(key)) return { upsertedCount: 0 };
      stored.set(key, { _id: filter._id, ...update.$setOnInsert });
      return { upsertedCount: 1 };
    });
  }
  assert.deepEqual(await insertSeedData(fixtures), { users: 18, products: 39, orders: 27, auctions: 12, bids: 27, reviews: 38 });
  const user = collections.get('users').values().next().value;
  user.nome = 'Nome alterado após seed';
  const before = JSON.stringify([...collections].map(([name, data]) => [name, [...data.values()]]));
  assert.deepEqual(await insertSeedData(seedData(passwordHash, new Date(0))), { users: 0, products: 0, orders: 0, auctions: 0, bids: 0, reviews: 0 });
  assert.equal(JSON.stringify([...collections].map(([name, data]) => [name, [...data.values()]])), before);
});
