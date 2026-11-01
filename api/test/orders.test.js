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

async function setup(t, { approved = true, stock = 5, second = false } = {}) {
  const products = [
    new Product({
      _id: productId,
      produtorId: producerId,
      nome: "Batata",
      descricao: "Teste",
      categoria: "Hortícolas",
      preco: 151,
      unidade: "kg",
      stock,
      publicado: true,
    }),
  ];
  if (second)
    products.push(
      new Product({
        ...products[0].toObject(),
        _id: "dca000000000000000000066",
        stock: 0,
      }),
    );
  let persisted;
  let ended = false;
  const session = {
    async withTransaction(fn) {
      const stocks = products.map((p) => p.stock);
      try {
        await fn();
      } catch (error) {
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
  t.mock.method(Product, "find", () => ({
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
      return approved ? { _id: producerId } : null;
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
  t.mock.method(Order, "create", async ([data], options) => {
    assert.equal(options.session, session);
    const document = new Order(data);
    await document.validate();
    persisted = document;
    document.populate = async () => document;
    return [document];
  });
  return {
    products,
    get persisted() {
      return persisted;
    },
    get ended() {
      return ended;
    },
    async invoke(linhas) {
      let error, status, body;
      const response = {
        status(code) {
          status = code;
          return this;
        },
        location() {
          return this;
        },
        json(data) {
          body = data;
        },
      };
      await handler(
        {
          body: { linhas, entrega: { tipo: "levantamento" } },
          user: { id: "dca000000000000000000002" },
        },
        response,
        (e) => {
          error = e;
        },
      );
      return { error, status, body };
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
    { produtoId: productId, quantidade: 0.75 },
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 201);
  assert.equal(result.body.linhas.length, 1);
  assert.equal(result.body.linhas[0].nome, "Batata");
  assert.equal(result.body.linhas[0].precoUnitario, 151);
  assert.equal(result.body.linhas[0].unidade, "kg");
  assert.equal(result.body.linhas[0].quantidade, 1.25);
  assert.equal(result.body.total, 189);
  assert.equal(fixture.products[0].stock, 3.75);
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
