import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import router from "../src/routes/orders.js";
import { Product, Order, User } from "../src/models/index.js";

const handler = router.stack
  .find((layer) => layer.route?.path === "/" && layer.route.methods.post)
  .route.stack.at(-1).handle;
const productId = "dca000000000000000000065";
const producerId = "dca000000000000000000004";

async function setup(
  t,
  {
    approved = true,
    stock = 5,
    unit = "kg",
    second = false,
    multi = false,
    unavailable = null,
    failWrite = false,
  } = {},
) {
  const products = [
    new Product({
      _id: productId,
      produtorId: producerId,
      nome: "Batata",
      descricao: "Teste",
      categoria: "Hortícolas",
      preco: 151,
      unidade: unit,
      stock,
      publicado: true,
    }),
  ];
  if (second)
    products.push(
      new Product({
        ...products[0].toObject(),
        _id: "dca000000000000000000066",
        stock: multi ? stock : 0,
        produtorId: multi ? "dca000000000000000000005" : producerId,
      }),
    );
  let persisted;
  let ended = false;
  const notifications = [];
  const session = {
    async withTransaction(fn) {
      const stocks = products.map((p) => p.stock);
      try {
        await fn();
      } catch (error) {
        persisted = undefined;
        products.forEach((p, i) => {
          p.stock = stocks[i];
        });
        throw error;
      }
    },
    async endSession() {
      ended = true;
    },
  };
  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(Product, "find", (filter) => ({
    session: async (supplied) => {
      assert.equal(supplied, session);
      return products;
    },
  }));
  t.mock.method(User, "findOne", (filter) => ({
    session: async (supplied) => {
      assert.equal(supplied, session);
      assert.equal(filter["perfilProdutor.validacao"], "aceite");
      assert.equal(filter.papel, "produtor");
      return approved && filter._id !== unavailable
        ? { _id: filter._id }
        : null;
    },
  }));
  t.mock.method(
    Product,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.equal(options.session, session);
      const product = products.find(
        (p) => String(p._id) === String(filter._id),
      );
      if (product.stock < filter.stock.$gte) return null;
      product.stock += update.$inc.stock;
      return product;
    },
  );
  t.mock.method(Order, "create", async (data, options) => {
    assert.equal(options.session, session);
    assert.equal(options.ordered, true);
    const documents = data.map((item) => new Order(item));
    for (const document of documents) await document.validate();
    persisted = documents;
    if (failWrite) throw new Error("Escrita interrompida");
    return documents;
  });
  return {
    products,
    notifications,
    get persisted() {
      return persisted;
    },
    get ended() {
      return ended;
    },
    async invoke(linhas, entrega = { tipo: "levantamento" }) {
      let error, status, body, location;
      const response = {
        status(code) {
          status = code;
          return this;
        },
        location(value) {
          location = value;
          return this;
        },
        json(data) {
          body = data;
        },
      };
      await handler(
        {
          body: { linhas, entrega },
          user: { id: "dca000000000000000000002" },
          app: {
            get: () => ({
              to: (room) => ({
                emit: (event, payload) =>
                  notifications.push({ room, event, payload }),
              }),
            }),
          },
        },
        response,
        (e) => {
          error = e;
        },
      );
      return { error, status, body, location };
    },
  };
}

test("Encomenda consolida IDs, ignora preços manipulados e guarda snapshot calculado", async (t) => {
  const fixture = await setup(t);
  const result = await fixture.invoke([
    {
      produtoId: productId.toUpperCase(),
      quantidade: 0.5,
      precoUnitario: 1,
      nome: "Falso",
      unidade: "l",
    },
    { produtoId: productId, quantidade: 1 },
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 201);
  assert.equal(result.location, "/api/orders");
  assert.equal(result.body.length, 1);
  assert.equal(result.body[0].linhas.length, 1);
  assert.equal(result.body[0].linhas[0].nome, "Batata");
  assert.equal(result.body[0].linhas[0].precoUnitario, 151);
  assert.equal(result.body[0].linhas[0].unidade, "kg");
  assert.equal(result.body[0].linhas[0].quantidade, 1.5);
  assert.equal(result.body[0].total, 227);
  assert.equal(fixture.products[0].stock, 3.5);
  assert.ok(fixture.ended);
});

test("Produtor indisponível impede reserva e encomenda", async (t) => {
  const fixture = await setup(t, { approved: false });
  const result = await fixture.invoke([
    { produtoId: productId, quantidade: 1 },
  ]);
  assert.equal(result.error.status, 409);
  assert.equal(fixture.products[0].stock, 5);
  assert.equal(fixture.persisted, undefined);
  assert.ok(fixture.ended);
});

test("Stock insuficiente na segunda linha aborta transação e não cria encomenda", async (t) => {
  const fixture = await setup(t, { second: true });
  const result = await fixture.invoke(
    fixture.products.map((p) => ({ produtoId: String(p._id), quantidade: 1 })),
  );
  assert.equal(result.error.status, 409);
  assert.deepEqual(
    fixture.products.map((p) => p.stock),
    [5, 0],
  );
  assert.equal(fixture.persisted, undefined);
  assert.ok(fixture.ended);
});

test("Rejeita linhas nulas antes de iniciar transação", async (t) => {
  const fixture = await setup(t);
  const result = await fixture.invoke([null]);
  assert.equal(result.status, 400);
  assert.equal(fixture.ended, false);
});

test("Entrega exige morada antes de reservar stock", async (t) => {
  const fixture = await setup(t);
  for (const entrega of [
    null,
    {},
    { tipo: "entrega" },
    { tipo: "entrega", morada: "  " },
  ]) {
    const result = await fixture.invoke(
      [{ produtoId: productId, quantidade: 1 }],
      entrega,
    );
    assert.equal(result.status, 400);
    assert.equal(fixture.ended, false);
    assert.equal(fixture.products[0].stock, 5);
  }
});

test("Aplica a mesma morada e modalidade a todos os produtores", async (t) => {
  const fixture = await setup(t, { second: true, multi: true });
  const result = await fixture.invoke(
    fixture.products.map((p) => ({ produtoId: p.id, quantidade: 1 })),
    { tipo: "entrega", morada: " Rua de Teste, 10 " },
  );
  assert.equal(result.status, 201);
  for (const order of result.body) {
    assert.equal(order.entrega.tipo, "entrega");
    assert.equal(order.entrega.morada, "Rua de Teste, 10");
  }
});

test("Uma finalização cria uma encomenda por produtor e desconta todo o stock", async (t) => {
  const fixture = await setup(t, { second: true, multi: true });
  const result = await fixture.invoke(
    fixture.products.map((p) => ({ produtoId: p.id, quantidade: 0.5 })),
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 201);
  assert.equal(result.body.length, 2);
  assert.notEqual(
    String(result.body[0].produtorId),
    String(result.body[1].produtorId),
  );
  assert.deepEqual(
    result.body.map((order) => order.total),
    [76, 76],
  );
  assert.deepEqual(
    fixture.products.map((p) => p.stock),
    [4.5, 4.5],
  );
});

for (const scenario of [
  "produtor indisponível",
  "stock insuficiente",
  "falha de escrita",
]) {
  test(`Compra de vários produtores reverte tudo: ${scenario}`, async (t) => {
    const fixture = await setup(t, {
      second: true,
      multi: true,
      unavailable:
        scenario === "produtor indisponível"
          ? "dca000000000000000000005"
          : null,
      failWrite: scenario === "falha de escrita",
    });
    if (scenario === "stock insuficiente") fixture.products[1].stock = 0;
    const stocks = fixture.products.map((p) => p.stock);
    const result = await fixture.invoke(
      fixture.products.map((p) => ({ produtoId: p.id, quantidade: 1 })),
    );
    assert.ok(result.error);
    assert.deepEqual(
      fixture.products.map((p) => p.stock),
      stocks,
    );
    assert.equal(fixture.persisted, undefined);
    assert.deepEqual(fixture.notifications, []);
    assert.ok(fixture.ended);
  });
}

for (const [unit, quantity, stock] of [
  ["unidade", 1, 5],
  ["g", 500, 1000],
  ["kg", 0.5, 0.7],
  ["l", 1.5, 2],
]) {
  test(`Aceita quantidades permitidas de ${unit}`, async (t) => {
    const fixture = await setup(t, { unit, stock });
    const result = await fixture.invoke([
      { produtoId: productId, quantidade: quantity },
    ]);
    assert.equal(result.status, 201);
    assert.equal(fixture.products[0].stock, stock - quantity);
  });
}

for (const [unit, quantities, stock] of [
  ["unidade", [0.5, 0.5], 5],
  ["g", [50, 50], 1000],
  ["kg", [0.25, 0.25], 5],
  ["l", [30.343], 100],
]) {
  test(`Rejeita linhas incompatíveis com ${unit} antes de qualquer reserva`, async (t) => {
    const fixture = await setup(t, { unit, stock });
    const result = await fixture.invoke(
      quantities.map((quantidade) => ({ produtoId: productId, quantidade })),
    );
    assert.equal(result.error.status, 400);
    assert.match(result.error.message, /múltiplos/);
    assert.equal(fixture.products[0].stock, stock);
    assert.equal(fixture.persisted, undefined);
    assert.deepEqual(fixture.notifications, []);
  });
}
