import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Product from '../src/models/Product.js';

const buyerId = 'dca000000000000000000002';
const producerId = 'dca000000000000000000004';
const adminId = 'dca000000000000000000001';
let server, base, hash;
process.env.JWT_SECRET = 'segredo-exclusivo-dos-testes-de-autenticacao';

before(async () => {
  hash = await bcrypt.hash('PasswordTeste123!', 4);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

function account(id = buyerId, papel = 'comprador', validacao = 'pendente') {
  return new User({ _id: id, nome: 'Conta teste', email: `${papel}@example.test`, papel, passwordHash: hash,
    ...(papel === 'produtor' ? { perfilProdutor: { localidade: 'Viana', morada: 'Rua da Quinta', coordenadas: { latitude: 41.7, longitude: -8.8 }, validacao } } : {}),
  });
}
const tokenFor = (id = buyerId, options = {}) => jwt.sign({ id, papel: 'comprador' }, process.env.JWT_SECRET, { expiresIn: '2h', ...options });
function users(t, records) {
  t.mock.method(User, 'findById', id => ({ select: async () => records.find(user => user.id === id) || null }));
  t.mock.method(User, 'findOne', filter => ({ select: async () => records.find(user => user.email === filter.email) || null }));
}
async function call(path, { token, method = 'GET', body, authorization } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(authorization ? { Authorization: authorization } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

test('Registo normaliza dados, guarda bcrypt custo 12 e mantém o contrato público', async t => {
  let stored;
  t.mock.method(User, 'create', async data => { stored = new User(data); await stored.validate(); return stored; });
  const response = await call('/auth/registo', { method: 'POST', body: { nome: '  Maria Silva  ', email: ' MARIA@example.test ', password: 'PasswordTeste123!' } });
  assert.equal(response.status, 201);
  assert.equal(response.body.nome, 'Maria Silva');
  assert.equal(response.body.email, 'maria@example.test');
  assert.equal(response.body.papel, 'comprador');
  assert.ok(response.body.id);
  assert.equal(response.body.passwordHash, undefined);
  assert.equal(response.body.password, undefined);
  assert.equal(bcrypt.getRounds(stored.passwordHash), 12);
  assert.ok(await bcrypt.compare('PasswordTeste123!', stored.passwordHash));
});

test('Registo bloqueia administrador, password curta e limite bcrypt em bytes UTF-8', async t => {
  t.mock.method(User, 'create', () => { throw new Error('Não deve criar conta.'); });
  for (const change of [{ papel: 'administrador' }, { password: 'curta' }, { password: 'á'.repeat(37) }]) {
    assert.equal((await call('/auth/registo', { method: 'POST', body: { nome: 'Maria', email: 'maria@example.test', password: 'PasswordTeste123!', ...change } })).status, 400);
  }
  assert.equal((await call('/auth/registo', { method: 'POST' })).status, 400);
});

test('Registo de produtor ignora aprovação manipulada e exige perfil completo', async t => {
  t.mock.method(User, 'create', async data => { const user = new User(data); await user.validate(); return user; });
  const body = { nome: 'Quinta', email: 'quinta@example.test', password: 'PasswordTeste123!', papel: 'produtor' };
  assert.equal((await call('/auth/registo', { method: 'POST', body })).status, 400);
  const response = await call('/auth/registo', { method: 'POST', body: { ...body,
    perfilProdutor: { localidade: 'Viana', morada: 'Rua da Quinta', coordenadas: { latitude: 41.7, longitude: -8.8 }, validacao: 'aceite' },
  } });
  assert.equal(response.status, 201);
  assert.equal(response.body.validacao, 'pendente');
});

test('Email duplicado devolve 409', async t => {
  t.mock.method(User, 'create', async () => { throw Object.assign(new Error('Duplicado'), { code: 11000 }); });
  assert.equal((await call('/auth/registo', { method: 'POST', body: { nome: 'Maria', email: 'maria@example.test', password: 'PasswordTeste123!' } })).status, 409);
});

test('Login devolve JWT assinado com expiração de duas horas e utilizador sem hash', async t => {
  const buyer = account();
  users(t, [buyer]);
  const result = await call('/auth/login', { method: 'POST', body: { email: ' COMPRADOR@example.test ', password: 'PasswordTeste123!' } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.utilizador, buyer.publico());
  const claims = jwt.verify(result.body.token, process.env.JWT_SECRET);
  assert.equal(claims.id, buyerId);
  assert.equal(claims.papel, 'comprador');
  assert.equal(claims.exp - claims.iat, 7200);
  assert.equal(result.body.utilizador.passwordHash, undefined);
});

test('Email inexistente e password errada têm a mesma resposta 401', async t => {
  users(t, [account()]);
  const missing = await call('/auth/login', { method: 'POST', body: { email: 'ninguem@example.test', password: 'PasswordTeste123!' } });
  const wrong = await call('/auth/login', { method: 'POST', body: { email: 'comprador@example.test', password: 'errada' } });
  assert.equal(missing.status, 401);
  assert.deepEqual(missing, wrong);
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: 'comprador@example.test', password: 123 } })).status, 400);
});

test('Login recusa sufixos além dos 72 bytes que bcrypt truncaria', async t => {
  const buyer = account();
  buyer.passwordHash = await bcrypt.hash('x'.repeat(72), 4);
  users(t, [buyer]);
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: buyer.email, password: 'x'.repeat(72) + 'sufixo' } })).status, 401);
});

test('Recuperação altera só o hash, aceita email normalizado e mantém os JWT existentes', async t => {
  const buyer = account();
  const original = buyer.toObject();
  users(t, [buyer]);
  t.mock.method(User, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { email: buyer.email });
    assert.deepEqual(Object.keys(update.$set), ['passwordHash']);
    assert.equal(options.runValidators, true);
    buyer.passwordHash = update.$set.passwordHash;
    return buyer;
  });
  const token = tokenFor();
  const response = await call('/auth/recuperar-password', { method: 'POST', body: {
    email: ' COMPRADOR@example.test ', password: 'NovaPasswordTeste123!', papel: 'administrador', nome: 'Nome adulterado',
  } });
  assert.deepEqual(response, { status: 200, body: { mensagem: 'Palavra-passe atualizada.' } });
  assert.equal(bcrypt.getRounds(buyer.passwordHash), 12);
  const { passwordHash: _old, ...previous } = original;
  const { passwordHash: _new, ...current } = buyer.toObject();
  assert.deepEqual(current, previous);
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: buyer.email, password: 'PasswordTeste123!' } })).status, 401);
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: buyer.email, password: 'NovaPasswordTeste123!' } })).status, 200);
  assert.equal((await call('/auth/eu', { token })).status, 200);
});

test('Recuperação valida email, tipos e limites antes de consultar a base', async t => {
  t.mock.method(User, 'findOneAndUpdate', () => { throw new Error('Não consultar com dados inválidos.'); });
  for (const body of [undefined, {}, { email: { $ne: null }, password: 'password123' },
    { email: 'email-invalido', password: 'password123' }, { email: 'comprador@example.test', password: 123 },
    { email: 'comprador@example.test', password: 'curta' }, { email: 'comprador@example.test', password: 'á'.repeat(37) }]) {
    assert.equal((await call('/auth/recuperar-password', { method: 'POST', body })).status, 400);
  }
});

test('Recuperação de conta inexistente devolve 404 sem criar utilizador', async t => {
  t.mock.method(User, 'findOneAndUpdate', async (_filter, _update, options) => {
    assert.notEqual(options.upsert, true);
    return null;
  });
  assert.equal((await call('/auth/recuperar-password', { method: 'POST', body: { email: 'ninguem@example.test', password: 'NovaPasswordTeste123!' } })).status, 404);
});

test('Sessão recusa tokens ausentes, expirados, adulterados, sem expiração ou claims inválidos', async t => {
  users(t, [account()]);
  const invalid = [undefined, 'invalido', tokenFor(buyerId, { expiresIn: -1 }),
    jwt.sign({ id: buyerId }, 'outro-segredo', { expiresIn: '2h' }),
    jwt.sign({ id: buyerId }, process.env.JWT_SECRET), tokenFor('id-invalido')];
  for (const token of invalid) assert.equal((await call('/auth/eu', { token })).status, 401);
  assert.equal((await call('/auth/eu', { authorization: `Bearer ${tokenFor()} extra` })).status, 401);
});

test('Sessão consulta os dados atuais, não expõe hash e recusa conta removida', async t => {
  const producer = account(producerId, 'produtor');
  users(t, [producer]);
  const token = tokenFor(producerId);
  producer.perfilProdutor.validacao = 'aceite';
  const response = await call('/auth/eu', { token });
  assert.equal(response.status, 200);
  assert.equal(response.body.papel, 'produtor');
  assert.equal(response.body.validacao, 'aceite');
  assert.equal(response.body.passwordHash, undefined);
  assert.equal((await call('/auth/eu', { token: tokenFor(adminId) })).status, 401);
});

test('Lista administrativa exige papel atual de administrador e não é a rota pública /:id', async t => {
  const admin = account(adminId, 'administrador');
  users(t, [account(), admin]);
  t.mock.method(User, 'find', filter => {
    assert.deepEqual(filter, { papel: 'produtor', 'perfilProdutor.validacao': 'pendente' });
    return { select(fields) { assert.equal(fields.includes('passwordHash'), false); return { sort: () => ({ lean: async () => [] }) }; } };
  });
  assert.equal((await call('/producers/pendentes')).status, 401);
  assert.equal((await call('/producers/pendentes', { token: tokenFor() })).status, 403);
  assert.deepEqual(await call('/producers/pendentes', { token: tokenFor(adminId) }), { status: 200, body: [] });
  admin.papel = 'comprador';
  assert.equal((await call('/producers/pendentes', { token: tokenFor(adminId) })).status, 403);
});

test('Aprovação e rejeição alteram permissões do produtor com o mesmo JWT', async t => {
  const producer = account(producerId, 'produtor');
  const admin = account(adminId, 'administrador');
  users(t, [producer, admin, account()]);
  t.mock.method(User, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter.papel, 'produtor');
    assert.equal(options.runValidators, true);
    if (filter._id !== producerId) return null;
    producer.perfilProdutor.validacao = update.$set['perfilProdutor.validacao'];
    return producer;
  });
  t.mock.method(Product, 'create', async data => ({ ...data, id: 'dca000000000000000000065', async populate() {} }));
  const producerToken = tokenFor(producerId);
  const product = () => call('/products', { token: producerToken, method: 'POST', body: { nome: 'Produto teste' } });
  const decide = (validacao, token = tokenFor(adminId), id = producerId) => call(`/producers/${id}/validacao`, { token, method: 'PATCH', body: { validacao } });
  assert.equal((await product()).status, 403);
  assert.equal((await decide('aceite', tokenFor())).status, 403);
  assert.equal((await decide('pendente')).status, 400);
  assert.equal((await decide('aceite', undefined, buyerId)).status, 404);
  assert.equal((await decide('aceite')).body.validacao, 'aceite');
  assert.equal((await product()).status, 201);
  assert.equal((await decide('rejeitado')).body.validacao, 'rejeitado');
  assert.equal((await product()).status, 403);
});
