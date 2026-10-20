import test, { beforeEach } from 'node:test';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import router from '../src/routes/products.js';
import Product from '../src/models/Product.js';
import Auction from '../src/models/Auction.js';

const handler = router.stack.find(layer => layer.route?.methods.delete).route.stack.at(-1).handle;
const id = 'dca000000000000000000065';
const producerId = 'dca000000000000000000004';
const filter = { _id: id, produtorId: producerId };
let session;
beforeEach(t => {
  session = { committed: false, ended: false, async withTransaction(fn) { await fn(); this.committed = true; }, async endSession() { this.ended = true; } };
  t.mock.method(mongoose, 'startSession', async () => session);
});

function mockExists(t, implementation) {
  return t.mock.method(Auction, 'exists', (...args) => ({ session: async supplied => { assert.equal(supplied, session); return implementation(...args); } }));
}

async function invoke() {
  const response = { code: 200, status(code) { this.code = code; return this; },
    json(body) { this.body = body; }, end() { assert.ok(session.committed); } };
  await handler({ params: { id }, user: { id: producerId } }, response, error => { if (error.status) { response.code = error.status; response.body = { erro: error.message }; } else throw error; });
  return response;
}

test('Apaga produto próprio sem leilões e devolve 204', async t => {
  t.mock.method(Product, 'findOneAndUpdate', async (query, update, options) => {
    assert.deepEqual(query, filter);
    assert.deepEqual(update, { $inc: { revisaoLeiloes: 1 } });
    assert.equal(options.session, session);
    assert.equal(options.timestamps, false);
    return { _id: id };
  });
  mockExists(t, async query => { assert.deepEqual(query, { 'produtos.produtoId': id }); return null; });
  const deletion = t.mock.method(Product, 'findOneAndDelete', async (query, options) => {
    assert.deepEqual(query, filter);
    assert.equal(options.session, session);
    return { _id: id };
  });
  assert.equal((await invoke()).code, 204);
  assert.equal(deletion.mock.callCount(), 1);
  assert.ok(session.ended);
});

for (const estado of ['agendado', 'ativo', 'terminado']) {
  test(`Não apaga produto com leilão ${estado}`, async t => {
    t.mock.method(Product, 'findOneAndUpdate', async () => ({ _id: id }));
    mockExists(t, async query => {
      assert.deepEqual(query, { 'produtos.produtoId': id });
      return { _id: 'auction' };
    });
    const deletion = t.mock.method(Product, 'findOneAndDelete', () => { throw new Error('Não deve apagar.'); });
    const response = await invoke();
    assert.equal(response.code, 409);
    assert.deepEqual(response.body, { erro: 'Não é possível apagar um produto com leilões associados.' });
    assert.equal(deletion.mock.callCount(), 0);
  });
}

test('Produto inexistente ou de outro produtor devolve 404 antes de consultar leilões', async t => {
  t.mock.method(Product, 'findOneAndUpdate', async query => { assert.deepEqual(query, filter); return null; });
  mockExists(t, () => { throw new Error('Não deve consultar leilões.'); });
  t.mock.method(Product, 'findOneAndDelete', () => { throw new Error('Não deve apagar.'); });
  assert.equal((await invoke()).code, 404);
});

test('Produto removido entre a consulta e a eliminação devolve 404', async t => {
  t.mock.method(Product, 'findOneAndUpdate', async () => ({ _id: id }));
  mockExists(t, async () => null);
  t.mock.method(Product, 'findOneAndDelete', async () => null);
  assert.equal((await invoke()).code, 404);
});

test('Proteção encontra o produto na segunda linha de um lote terminado', async t => {
  const auction = { estado: 'terminado', produtos: [
    { produtoId: 'dca000000000000000000067' }, { produtoId: id },
  ] };
  t.mock.method(Product, 'findOneAndUpdate', async () => ({ _id: id }));
  mockExists(t, async query =>
    auction.produtos.some(line => line.produtoId === query['produtos.produtoId']) ? { _id: 'auction' } : null);
  t.mock.method(Product, 'findOneAndDelete', () => { throw new Error('Não deve apagar.'); });
  assert.equal((await invoke()).code, 409);
});
