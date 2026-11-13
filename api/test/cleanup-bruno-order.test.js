import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Order, Product } from "../src/models/index.js";
import { cleanupBrunoOrder } from "../src/scripts/cleanup-bruno.js";

function setup(t) {
  const owner = "bruno-user";
  let order = {
    _id: "order",
    compradorId: owner,
    leilaoId: null,
    linhas: [
      { produtoId: "a", quantidade: 1.5 },
      { produtoId: "b", quantidade: 2 },
    ],
  };
  const stock = { a: 3, b: 4 };
  let fail = false;
  let ended = 0;
  const session = {
    async withTransaction(run) {
      const previous = { ...stock };
      const oldOrder = order;
      try {
        await run();
      } catch (error) {
        Object.assign(stock, previous);
        order = oldOrder;
        throw error;
      }
    },
    async endSession() {
      ended++;
    },
  };
  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(Order, "findOneAndDelete", async (filter, options) => {
    assert.equal(options.session, session);
    assert.equal(filter.leilaoId, null);
    if (
      !order ||
      filter._id !== order._id ||
      !filter.compradorId.$in.includes(order.compradorId)
    )
      return null;
    const deleted = order;
    order = null;
    return deleted;
  });
  t.mock.method(Product, "updateOne", async (filter, update, options) => {
    assert.equal(options.session, session);
    if (fail && filter._id === "b") throw new Error("interrompido");
    if (!(filter._id in stock)) return { matchedCount: 0 };
    stock[filter._id] += update.$inc.stock;
    return { matchedCount: 1 };
  });
  return {
    owner,
    stock,
    get order() {
      return order;
    },
    get ended() {
      return ended;
    },
    interrupt() {
      fail = true;
    },
    resume() {
      fail = false;
    },
  };
}

test("Interrupção reverte eliminação e todas as reposições; repetição repõe uma vez", async (t) => {
  const state = setup(t);
  state.interrupt();
  await assert.rejects(
    cleanupBrunoOrder("order", [state.owner]),
    /interrompido/,
  );
  assert.ok(state.order);
  assert.deepEqual(state.stock, { a: 3, b: 4 });
  state.resume();
  await cleanupBrunoOrder("order", [state.owner]);
  assert.equal(state.order, null);
  assert.deepEqual(state.stock, { a: 4.5, b: 6 });
  await cleanupBrunoOrder("order", [state.owner]);
  assert.deepEqual(state.stock, { a: 4.5, b: 6 });
  assert.equal(state.ended, 3);
});

test("Não altera encomenda que não pertence aos compradores de teste", async (t) => {
  const state = setup(t);
  await cleanupBrunoOrder("order", ["outro"]);
  assert.ok(state.order);
  assert.deepEqual(state.stock, { a: 3, b: 4 });
});
