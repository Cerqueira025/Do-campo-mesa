import test from 'node:test';
import assert from 'node:assert/strict';
import router from '../src/routes/orders.js';
import Order from '../src/models/Order.js';

const id = 'dca0000000000000000000c9';
const owner = 'dca000000000000000000004';
const handler = router.stack.find(layer => layer.route?.path === '/:id/estado').route.stack.at(-1).handle;
async function invoke(estado) {
  const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await handler({ params: { id }, user: { id: owner }, body: { estado } }, response, error => { throw error; });
  return response;
}

test('Atualiza só o estado esperado e grava a entrega na mesma operação', async t => {
  let stored = { _id: id, produtorId: owner, estado: 'pendente' };
  t.mock.method(Order, 'findOne', async filter => {
    assert.deepEqual(filter, { _id: id, produtorId: owner });
    return { ...stored };
  });
  t.mock.method(Order, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { _id: id, produtorId: owner, estado: stored.estado });
    assert.deepEqual(options, { new: true, runValidators: true });
    assert.deepEqual(Object.keys(update.$set).sort(), update.$set.estado === 'entregue' ? ['dataEntrega', 'estado'] : ['estado']);
    stored = { ...stored, ...update.$set };
    return stored;
  });
  for (const state of ['confirmada', 'pronta', 'entregue']) {
    const response = await invoke(state);
    assert.equal(response.code, 200);
    assert.equal(response.body.estado, state);
  }
  assert.ok(stored.dataEntrega instanceof Date);
});

test('Pedido atrasado recebe 409 e não faz recuar a encomenda', async t => {
  let stored = { _id: id, produtorId: owner, estado: 'pendente' };
  let release, reached;
  const waiting = new Promise(resolve => { reached = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let first = true;
  t.mock.method(Order, 'findOne', async () => ({ ...stored }));
  t.mock.method(Order, 'findOneAndUpdate', async (filter, update) => {
    if (first) { first = false; reached(); await gate; }
    if (stored.estado !== filter.estado) return null;
    stored = { ...stored, ...update.$set };
    return { ...stored };
  });
  const delayed = invoke('confirmada');
  await waiting;
  assert.equal((await invoke('confirmada')).code, 200);
  assert.equal((await invoke('pronta')).code, 200);
  release();
  assert.equal((await delayed).code, 409);
  assert.equal(stored.estado, 'pronta');
});

test('Duas entregas simultâneas só gravam uma data de entrega', async t => {
  let stored = { _id: id, estado: 'pronta' }, writes = 0;
  t.mock.method(Order, 'findOne', async () => ({ ...stored }));
  t.mock.method(Order, 'findOneAndUpdate', async (filter, update) => {
    if (filter.estado !== stored.estado) return null;
    stored = { ...stored, ...update.$set }; writes++;
    return stored;
  });
  assert.deepEqual((await Promise.all([invoke('entregue'), invoke('entregue')])).map(result => result.code).sort(), [200, 409]);
  assert.equal(writes, 1);
  const delivery = stored.dataEntrega;
  assert.equal((await invoke('entregue')).code, 409);
  assert.equal(stored.dataEntrega, delivery);
});

test('Preserva 400, 404 e 409 sem escrever em transições inválidas', async t => {
  t.mock.method(Order, 'findOneAndUpdate', () => { throw new Error('Não escrever.'); });
  t.mock.method(Order, 'findOne', async () => null);
  assert.equal((await invoke('confirmada')).code, 404);
  assert.equal((await invoke('invalido')).code, 400);
  t.mock.method(Order, 'findOne', async () => ({ estado: 'pendente' }));
  for (const state of ['pendente', 'pronta', 'entregue']) assert.equal((await invoke(state)).code, 409);
});
