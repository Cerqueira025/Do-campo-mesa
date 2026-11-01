import test from "node:test";
import assert from "node:assert/strict";
import router from "../src/routes/orders.js";
import Order from "../src/models/Order.js";
import Review from "../src/models/Review.js";
import User from "../src/models/User.js";
import app from "../src/app.js";
import jwt from "jsonwebtoken";

const handler = router.stack
  .find((layer) => layer.route?.path === "/:id/reviews")
  .route.stack.at(-1).handle;
const id = "dca0000000000000000000c9";
const buyer = "dca000000000000000000002";
async function invoke(orderId = id, buyerId = buyer) {
  const response = {
    code: 200,
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  await handler(
    { params: { id: orderId }, user: { id: buyerId } },
    response,
    (error) => {
      throw error;
    },
  );
  return response;
}

test("Comprador recupera as suas avaliações, incluindo ocultas e denunciadas", async (t) => {
  const reviews = ["publicada", "oculta", "denunciada"].map((estado) => ({
    estado,
    autorId: buyer,
    encomendaId: id,
  }));
  t.mock.method(Order, "findOne", async (filter) => {
    assert.deepEqual(filter, { _id: id, compradorId: buyer });
    return { _id: id };
  });
  t.mock.method(Review, "find", (filter) => {
    assert.deepEqual(filter, { encomendaId: id, autorId: buyer });
    return { sort: async () => reviews };
  });
  const response = await invoke();
  assert.equal(response.code, 200);
  assert.deepEqual(response.body, reviews);
});

test("Encomenda alheia ou inexistente devolve 404 sem consultar avaliações", async (t) => {
  t.mock.method(Order, "findOne", async (filter) => {
    assert.equal(filter.compradorId, "other");
    return null;
  });
  t.mock.method(Review, "find", () => {
    throw new Error("Não deve consultar");
  });
  assert.equal((await invoke(id, "other")).code, 404);
});

test("ID inválido devolve 404 sem aceder à base de dados", async (t) => {
  t.mock.method(Order, "findOne", () => {
    throw new Error("Não deve consultar");
  });
  assert.equal((await invoke("invalid")).code, 404);
});

test("HTTP protege avaliações por papel, sessão e propriedade da encomenda", async (t) => {
  process.env.JWT_SECRET = "order-review-http-test-secret";
  let role = "comprador";
  const account = { id: buyer, papel: role };
  t.mock.method(User, "findById", () => ({
    select: async () => ({ ...account, papel: role }),
  }));
  t.mock.method(Order, "findOne", async (filter) =>
    filter._id === id && filter.compradorId === buyer ? { _id: id } : null,
  );
  t.mock.method(Review, "find", () => ({ sort: async () => [] }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/orders`;
  const token = jwt.sign({ id: buyer }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  const headers = { Authorization: `Bearer ${token}` };
  assert.equal((await fetch(`${base}/${id}/reviews`)).status, 401);
  role = "produtor";
  assert.equal((await fetch(`${base}/${id}/reviews`, { headers })).status, 403);
  role = "administrador";
  assert.equal((await fetch(`${base}/${id}/reviews`, { headers })).status, 403);
  role = "comprador";
  assert.equal(
    (await fetch(`${base}/dca0000000000000000000ca/reviews`, { headers }))
      .status,
    404,
  );
  const response = await fetch(`${base}/${id}/reviews`, { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});
