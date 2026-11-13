import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import User from "../src/models/User.js";
import { resetPassword } from "../src/services/resetPassword.js";
import Product from "../src/models/Product.js";
import Auction from "../src/models/Auction.js";
import mongoose from "mongoose";

const buyerId = "dca000000000000000000002";
const producerId = "dca000000000000000000004";
const adminId = "dca000000000000000000001";
let server, base, hash;
process.env.JWT_SECRET = "segredo-exclusivo-dos-testes-de-autenticacao";

before(async () => {
  hash = await bcrypt.hash("PasswordTeste123!", 4);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

function account(id = buyerId, papel = "comprador", validacao = "pendente") {
  return new User({
    _id: id,
    nome: "Conta teste",
    email: `${papel}@example.test`,
    papel,
    passwordHash: hash,
    ...(papel === "produtor"
      ? {
          perfilProdutor: {
            localidade: "Viana",
            morada: "Rua da Quinta",
            coordenadas: { latitude: 41.7, longitude: -8.8 },
            validacao,
          },
        }
      : {}),
  });
}
const tokenFor = (id = buyerId, options = {}) =>
  jwt.sign({ id, papel: "comprador" }, process.env.JWT_SECRET, {
    expiresIn: "2h",
    ...options,
  });
function users(t, records) {
  t.mock.method(User, "findById", (id) => ({
    select: async () => records.find((user) => user.id === id) || null,
  }));
  t.mock.method(User, "findOne", (filter) => ({
    select: async () =>
      records.find((user) => user.email === filter.email) || null,
  }));
}
async function call(path, { token, method = "GET", body, authorization } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

test("Registo normaliza dados, guarda bcrypt custo 12 e mantém o contrato público", async (t) => {
  let stored;
  t.mock.method(User, "create", async (data) => {
    stored = new User(data);
    await stored.validate();
    return stored;
  });
  const response = await call("/auth/registo", {
    method: "POST",
    body: {
      nome: "  Maria Silva  ",
      email: " MARIA@example.test ",
      password: "PasswordTeste123!",
    },
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.nome, "Maria Silva");
  assert.equal(response.body.email, "maria@example.test");
  assert.equal(response.body.papel, "comprador");
  assert.ok(response.body.id);
  assert.equal(response.body.passwordHash, undefined);
  assert.equal(response.body.password, undefined);
  assert.equal(bcrypt.getRounds(stored.passwordHash), 12);
  assert.ok(await bcrypt.compare("PasswordTeste123!", stored.passwordHash));
});

test("Registo bloqueia administrador, password curta e limite bcrypt em bytes UTF-8", async (t) => {
  t.mock.method(User, "create", () => {
    throw new Error("Não deve criar conta.");
  });
  for (const change of [
    { papel: "administrador" },
    { password: "curta" },
    { password: "á".repeat(37) },
  ]) {
    assert.equal(
      (
        await call("/auth/registo", {
          method: "POST",
          body: {
            nome: "Maria",
            email: "maria@example.test",
            password: "PasswordTeste123!",
            ...change,
          },
        })
      ).status,
      400,
    );
  }
  assert.equal((await call("/auth/registo", { method: "POST" })).status, 400);
});

test("Registo de produtor ignora aprovação manipulada e exige perfil completo", async (t) => {
  t.mock.method(User, "create", async (data) => {
    const user = new User(data);
    await user.validate();
    return user;
  });
  const body = {
    nome: "Quinta",
    email: "quinta@example.test",
    password: "PasswordTeste123!",
    papel: "produtor",
  };
  assert.equal(
    (await call("/auth/registo", { method: "POST", body })).status,
    400,
  );
  const response = await call("/auth/registo", {
    method: "POST",
    body: {
      ...body,
      validacao: "aceite",
      perfilProdutor: {
        localidade: "Viana",
        morada: "Rua da Quinta",
        coordenadas: { latitude: 41.7, longitude: -8.8 },
        validacao: "aceite",
      },
    },
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.validacao, "pendente");
});

test("Email duplicado devolve 409", async (t) => {
  t.mock.method(User, "create", async () => {
    throw Object.assign(new Error("Duplicado"), { code: 11000 });
  });
  assert.equal(
    (
      await call("/auth/registo", {
        method: "POST",
        body: {
          nome: "Maria",
          email: "maria@example.test",
          password: "PasswordTeste123!",
        },
      })
    ).status,
    409,
  );
});

test("Login devolve JWT assinado com expiração de duas horas e utilizador sem hash", async (t) => {
  const buyer = account();
  users(t, [buyer]);
  const result = await call("/auth/login", {
    method: "POST",
    body: { email: " COMPRADOR@example.test ", password: "PasswordTeste123!" },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.utilizador, buyer.publico());
  const claims = jwt.verify(result.body.token, process.env.JWT_SECRET);
  assert.equal(claims.id, buyerId);
  assert.equal(claims.papel, "comprador");
  assert.equal(claims.exp - claims.iat, 7200);
  assert.equal(result.body.utilizador.passwordHash, undefined);
});

test("Email inexistente e password errada têm a mesma resposta 401", async (t) => {
  users(t, [account()]);
  const missing = await call("/auth/login", {
    method: "POST",
    body: { email: "ninguem@example.test", password: "PasswordTeste123!" },
  });
  const wrong = await call("/auth/login", {
    method: "POST",
    body: { email: "comprador@example.test", password: "errada" },
  });
  assert.equal(missing.status, 401);
  assert.deepEqual(missing, wrong);
  assert.equal(
    (
      await call("/auth/login", {
        method: "POST",
        body: { email: "comprador@example.test", password: 123 },
      })
    ).status,
    400,
  );
});

test("Login recusa sufixos além dos 72 bytes que bcrypt truncaria", async (t) => {
  const buyer = account();
  buyer.passwordHash = await bcrypt.hash("x".repeat(72), 4);
  users(t, [buyer]);
  assert.equal(
    (
      await call("/auth/login", {
        method: "POST",
        body: { email: buyer.email, password: "x".repeat(72) + "sufixo" },
      })
    ).status,
    401,
  );
});

test("A API já não oferece recuperação pública de palavra-passe", async () => {
  const response = await call("/auth/recuperar-password", {
    method: "POST",
    body: { email: "comprador@example.test", password: "NovaPassword123!" },
  });
  assert.equal(response.status, 404);
});

test("Redefinição local revoga os tokens da conta e mantém as restantes sessões", async (t) => {
  const buyer = account();
  const other = account(adminId, "administrador");
  users(t, [buyer, other]);
  t.mock.method(User, "updateOne", async (filter, update, options) => {
    assert.deepEqual(filter, { email: buyer.email });
    assert.deepEqual(update.$inc, { sessionVersion: 1 });
    assert.equal(options.runValidators, true);
    buyer.passwordHash = update.$set.passwordHash;
    buyer.sessionVersion += update.$inc.sessionVersion;
    return { modifiedCount: 1 };
  });

  const oldToken = tokenFor(buyer.id);
  assert.equal((await call("/auth/eu", { token: oldToken })).status, 200);
  const password = await resetPassword(" COMPRADOR@EXAMPLE.TEST ");
  assert.equal(bcrypt.getRounds(buyer.passwordHash), 12);
  assert.equal((await call("/auth/eu", { token: oldToken })).status, 401);
  assert.equal(
    (await call("/auth/eu", { token: tokenFor(other.id) })).status,
    200,
  );

  const login = (password) =>
    call("/auth/login", {
      method: "POST",
      body: { email: buyer.email, password },
    });
  assert.equal((await login("PasswordTeste123!")).status, 401);
  const current = await login(password);
  assert.equal(current.status, 200);
  assert.equal(current.body.utilizador.sessionVersion, undefined);
  assert.equal(
    (await call("/auth/eu", { token: current.body.token })).status,
    200,
  );
});

test("Redefinição local não devolve palavra-passe para conta inexistente ou erro de escrita", async (t) => {
  const update = t.mock.method(User, "updateOne", async () => ({
    modifiedCount: 0,
  }));
  assert.equal(await resetPassword("inexistente@example.test"), null);
  update.mock.mockImplementation(async () => {
    throw new Error("Escrita falhou");
  });
  await assert.rejects(
    resetPassword("inexistente@example.test"),
    /Escrita falhou/,
  );
});

test("Sessão recusa tokens ausentes, expirados, adulterados, sem expiração ou claims inválidos", async (t) => {
  users(t, [account()]);
  const invalid = [
    undefined,
    "invalido",
    tokenFor(buyerId, { expiresIn: -1 }),
    jwt.sign({ id: buyerId }, "outro-segredo", { expiresIn: "2h" }),
    jwt.sign({ id: buyerId }, process.env.JWT_SECRET),
    tokenFor("id-invalido"),
  ];
  for (const token of invalid)
    assert.equal((await call("/auth/eu", { token })).status, 401);
  assert.equal(
    (await call("/auth/eu", { authorization: `Bearer ${tokenFor()} extra` }))
      .status,
    401,
  );
});

test("Sessão consulta os dados atuais, não expõe hash e recusa conta removida", async (t) => {
  const producer = account(producerId, "produtor");
  users(t, [producer]);
  const token = tokenFor(producerId);
  producer.perfilProdutor.validacao = "aceite";
  const response = await call("/auth/eu", { token });
  assert.equal(response.status, 200);
  assert.equal(response.body.papel, "produtor");
  assert.equal(response.body.validacao, "aceite");
  assert.equal(response.body.passwordHash, undefined);
  assert.equal(
    (await call("/auth/eu", { token: tokenFor(adminId) })).status,
    401,
  );
});

test("Lista administrativa exige papel atual de administrador e não é a rota pública /:id", async (t) => {
  const admin = account(adminId, "administrador");
  users(t, [account(), admin]);
  t.mock.method(User, "find", (filter) => {
    assert.deepEqual(filter, {
      papel: "produtor",
      "perfilProdutor.validacao": "pendente",
    });
    return {
      select(fields) {
        assert.equal(fields.includes("passwordHash"), false);
        return { sort: () => ({ lean: async () => [] }) };
      },
    };
  });
  assert.equal((await call("/producers/pendentes")).status, 401);
  assert.equal(
    (await call("/producers/pendentes", { token: tokenFor() })).status,
    403,
  );
  assert.deepEqual(
    await call("/producers/pendentes", { token: tokenFor(adminId) }),
    { status: 200, body: [] },
  );
  admin.papel = "comprador";
  assert.equal(
    (await call("/producers/pendentes", { token: tokenFor(adminId) })).status,
    403,
  );
});

test("Aprovação ou rejeição resolve um registo pendente uma vez e atualiza as permissões com o mesmo JWT", async (t) => {
  const producer = account(producerId, "produtor");
  const admin = account(adminId, "administrador");
  users(t, [producer, admin, account()]);
  t.mock.method(User, "exists", async (filter) =>
    filter._id === producerId ? { _id: producerId } : null,
  );
  t.mock.method(User, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(Object.keys(update.$set), [
      "perfilProdutor.validacao",
      "ultimaDecisao",
    ]);
    assert.equal(filter.papel, "produtor");
    assert.equal(options.runValidators, true);
    if (
      filter._id !== producerId ||
      producer.perfilProdutor.validacao !== filter["perfilProdutor.validacao"]
    )
      return null;
    producer.perfilProdutor.validacao = update.$set["perfilProdutor.validacao"];
    producer.ultimaDecisao = update.$set.ultimaDecisao;
    return producer;
  });
  const productId = "dca000000000000000000065";
  const productWrite = t.mock.method(Product, "create", async (data) => ({
    ...data,
    id: productId,
    async populate() {},
  }));
  t.mock.method(mongoose, "startSession", async () => ({
    async withTransaction(fn) {
      await fn();
    },
    async endSession() {},
  }));
  const productRead = t.mock.method(
    Product,
    "findOneAndUpdate",
    async (filter) => {
      assert.deepEqual(filter, {
        _id: productId,
        produtorId: producerId,
        publicado: true,
        bloqueado: { $ne: true },
      });
      return { _id: productId, stock: 10, unidade: "kg" };
    },
  );
  const auctionWrite = t.mock.method(Auction, "create", async ([data]) => [
    {
      ...data,
      id: "dca000000000000000004001",
      $session() {},
      async populate() {},
    },
  ]);
  t.mock.method(Product, "findOneAndDelete", () => {
    throw new Error("Não deve apagar.");
  });
  t.mock.method(Product.prototype, "save", () => {
    throw new Error("Não deve alterar.");
  });
  const session = await call("/auth/login", {
    method: "POST",
    body: { email: producer.email, password: "PasswordTeste123!" },
  });
  assert.equal(session.status, 200);
  const producerToken = session.body.token;
  const product = () =>
    call("/products", {
      token: producerToken,
      method: "POST",
      body: { nome: "Produto teste" },
    });
  const auction = () =>
    call("/auctions", {
      token: producerToken,
      method: "POST",
      body: {
        produtos: [{ produtoId: productId, quantidade: 5 }],
        lote: "5 kg",
        precoBase: 100,
        incremento: 10,
        dataInicio: new Date(Date.now()).toISOString(),
        dataFim: new Date(Date.now() + 3600000).toISOString(),
      },
    });
  async function blocked(validacao) {
    const writes = [
      productWrite.mock.callCount(),
      auctionWrite.mock.callCount(),
      productRead.mock.callCount(),
    ];
    assert.equal((await product()).status, 403);
    assert.equal((await auction()).status, 403);
    for (const method of ["PUT", "DELETE"]) {
      assert.equal(
        (
          await call(`/products/${productId}`, {
            token: producerToken,
            method,
            body: { nome: "Alterado" },
          })
        ).status,
        403,
      );
    }
    assert.deepEqual(
      [
        productWrite.mock.callCount(),
        auctionWrite.mock.callCount(),
        productRead.mock.callCount(),
      ],
      writes,
    );
    const current = await call("/auth/eu", { token: producerToken });
    assert.equal(current.status, 200);
    assert.equal(current.body.validacao, validacao);
  }
  const decide = (validacao, token = tokenFor(adminId), id = producerId) =>
    call(`/producers/${id}/validacao`, {
      token,
      method: "PATCH",
      body: { validacao, motivo: "Decisão de teste" },
    });
  await blocked("pendente");
  assert.equal((await decide("aceite", tokenFor())).status, 403);
  assert.equal((await decide("pendente")).status, 400);
  assert.equal((await decide("aceite", undefined, buyerId)).status, 404);
  assert.equal((await decide("aceite")).body.validacao, "aceite");
  assert.equal((await product()).status, 201);
  assert.equal((await auction()).status, 201);
  assert.equal(productWrite.mock.callCount(), 1);
  assert.equal(auctionWrite.mock.callCount(), 1);
  assert.equal(
    (await call("/auth/eu", { token: producerToken })).body.validacao,
    "aceite",
  );
  assert.equal((await decide("rejeitado")).status, 409);
  assert.equal(
    (await call("/auth/eu", { token: producerToken })).body.validacao,
    "aceite",
  );
  // A separate pending registration can be rejected, but cannot be approved afterwards.
  producer.perfilProdutor.validacao = "pendente";
  producer.ultimaDecisao = undefined;
  assert.equal((await decide("rejeitado")).body.validacao, "rejeitado");
  await blocked("rejeitado");
  assert.equal((await decide("aceite")).status, 409);
});
