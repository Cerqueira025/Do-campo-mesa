import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import router from "../src/routes/products.js";
import Product from "../src/models/Product.js";
import Auction from "../src/models/Auction.js";

const id = "000000000000000000000001";
const owner = "000000000000000000000002";
const handler = router.stack
  .find((layer) => layer.route?.methods.put)
  .route.stack.at(-1).handle;
async function invoke(body) {
  let error, data;
  await handler(
    { params: { id }, user: { id: owner }, body },
    {
      json(value) {
        data = value;
      },
    },
    (value) => {
      error = value;
    },
  );
  return { error, data };
}

function setup(t, reserved) {
  const session = {
    async withTransaction(fn) {
      await fn();
    },
    async endSession() {},
  };
  t.mock.method(mongoose, "startSession", async () => session);
  const product = Product.hydrate({
    _id: id,
    produtorId: owner,
    nome: "Batata",
    stock: 10,
    unidade: "kg",
  });
  t.mock.method(Product, "findOne", () => ({
    select(value) {
      assert.equal(value, "-imagens");
      return this;
    },
    session(value) {
      assert.equal(value, session);
      return Promise.resolve(product);
    },
    then(resolve) {
      resolve(product);
    },
  }));
  t.mock.method(Auction, "exists", (filter) => {
    assert.deepEqual(filter.reservaStock, { $in: ["reservada", "atribuida"] });
    assert.equal(String(filter["produtos.produtoId"]), id);
    return {
      session: async (value) => {
        assert.equal(value, session);
        return reserved ? { _id: "auction" } : null;
      },
    };
  });
  const save = t.mock.method(product, "save", async (options) => {
    if (product.isModified("stock") || product.isModified("unidade"))
      assert.equal(options.session, session);
    return product;
  });
  t.mock.method(product, "populate", async () => product);
  return { product, save };
}

for (const state of ["reservada", "atribuida"]) {
  for (const body of [{ stock: 20 }, { unidade: "g" }]) {
    test(`Bloqueia ${Object.keys(body)[0]} quando existe quantidade ${state}`, async (t) => {
      const { save } = setup(t, state);
      assert.equal((await invoke(body)).error.status, 409);
      assert.equal(save.mock.callCount(), 0);
    });
  }
}
test("Outros dados continuam editáveis com reserva", async (t) => {
  const { save } = setup(t, true);
  const result = await invoke({ nome: "Nova batata" });
  assert.equal(result.error, undefined);
  assert.equal(result.data.nome, "Nova batata");
  assert.equal(save.mock.callCount(), 1);
});
test("Sem compromissos permite alterar stock na transação", async (t) => {
  setup(t, false);
  const result = await invoke({ stock: 20 });
  assert.equal(result.error, undefined);
  assert.equal(result.data.stock, 20);
});
