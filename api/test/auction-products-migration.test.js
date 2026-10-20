import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { migrateAuctionProducts } from '../src/scripts/auction-products-migration.js';

const id = value => new mongoose.Types.ObjectId(value.toString(16).padStart(24, '0'));
const legacy = () => ({
  _id: id(1), produtorId: id(2), produtoId: id(3), quantidade: 1.5, unidade: 'kg',
  lote: 'Lote antigo', precoBase: 1000, incremento: 100, estado: 'ativo',
  dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-01-02'),
  licitacaoAtual: { valor: 1200, compradorId: id(4) },
  createdAt: new Date('2025-12-01'), updatedAt: new Date('2026-01-01'), __v: 2,
});

function fixture(documents) {
  let writes = 0;
  return {
    find() { return { toArray: async () => documents }; },
    async bulkWrite(operations) {
      writes++;
      for (const { updateOne: { filter, update } } of operations) {
        const document = documents.find(row => String(row._id) === String(filter._id));
        Object.assign(document, update.$set);
        for (const key of Object.keys(update.$unset)) delete document[key];
      }
      return { modifiedCount: operations.length };
    },
    get writes() { return writes; },
  };
}

test('Migração preserva todos os dados exceto a representação dos produtos e pode repetir-se', async () => {
  const document = legacy();
  const { produtoId, quantidade, unidade, ...unchanged } = document;
  const expected = { ...unchanged, produtos: [{ produtoId, quantidade, unidade }] };
  const collection = fixture([document]);
  assert.equal(await migrateAuctionProducts(collection), 1);
  assert.deepEqual(document, expected);
  assert.equal(await migrateAuctionProducts(collection), 0);
  assert.equal(collection.writes, 1);
  assert.deepEqual(document, expected);
});

test('Um documento inválido no fim interrompe toda a migração antes da primeira escrita', async () => {
  for (const changes of [
    { quantidade: undefined }, { quantidade: '1' }, { produtoId: undefined }, { unidade: 'caixa' },
    { produtos: [{ produtoId: id(3), quantidade: 1, unidade: 'kg' }] },
    { produtos: [] },
  ]) {
    const first = legacy();
    const invalid = { ...legacy(), _id: id(9), ...changes };
    const collection = fixture([first, invalid]);
    await assert.rejects(migrateAuctionProducts(collection), error =>
      error.name === 'AuctionMigrationError' && error.message.includes(String(invalid._id)));
    assert.equal(collection.writes, 0);
    assert.deepEqual(first, legacy());
  }
});

test('Lista já convertida inválida também impede a primeira escrita', async () => {
  const { produtoId, quantidade, unidade, ...rest } = legacy();
  const invalid = { ...rest, _id: id(9), produtos: [{ produtoId, quantidade, unidade }, { produtoId, quantidade, unidade }] };
  const collection = fixture([legacy(), invalid]);
  await assert.rejects(migrateAuctionProducts(collection), { name: 'AuctionMigrationError' });
  assert.equal(collection.writes, 0);
});

test('Documentos já convertidos ficam intactos e referências órfãs não são corrigidas', async () => {
  const old = legacy();
  const { produtoId, quantidade, unidade, ...rest } = old;
  const converted = { ...rest, _id: id(8), produtos: [{ produtoId, quantidade, unidade }] };
  const before = { ...converted };
  const collection = fixture([old, converted]);
  assert.equal(await migrateAuctionProducts(collection), 1);
  assert.deepEqual(converted, before);
  assert.equal(String(old.produtos[0].produtoId), String(produtoId));
});
