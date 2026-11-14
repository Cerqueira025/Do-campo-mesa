import test from "node:test";
import assert from "node:assert/strict";
import router from "../src/routes/orders.js";
import Order from "../src/models/Order.js";

const id = "dca000000000000000000201";
const buyer = "dca000000000000000000002";
const producer = "dca000000000000000000004";
const auction = "dca000000000000000000301";
const delivery = router.stack
  .find((layer) => layer.route?.path === "/:id/entrega")
  .route.stack.at(-1).handle;
const advance = router.stack
  .find((layer) => layer.route?.path === "/:id/estado")
  .route.stack.at(-1).handle;

function fixture(t) {
  const order = {
    _id: id,
    compradorId: buyer,
    produtorId: producer,
    leilaoId: auction,
    estado: "pendente",
    entrega: null,
  };
  const events = [];
  t.mock.method(Order, "findOne", async (filter) =>
    filter._id === id &&
    (filter.compradorId === buyer || filter.produtorId === producer)
      ? order
      : null,
  );
  t.mock.method(Order, "findOneAndUpdate", async (filter, update) => {
    if (
      order.estado !== filter.estado ||
      (filter.entrega === null && order.entrega)
    )
      return null;
    Object.assign(order, update.$set);
    return order;
  });
  async function invoke(handler, userId, body, orderId = id) {
    const response = {
      status(code) {
        this.code = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    let error;
    await handler(
      {
        params: { id: orderId },
        body,
        user: { id: userId, nome: "Ana" },
        app: {
          get: () => ({
            to: (room) => ({
              emit: (event, payload) => events.push({ room, event, payload }),
            }),
          }),
        },
      },
      response,
      (failure) => {
        error = failure;
      },
    );
    if (error) throw error;
    return response;
  }
  return { order, events, invoke };
}

test("Vencedor escolhe entrega, estado avança uma vez e notifica o produtor", async (t) => {
  const { order, events, invoke } = fixture(t);
  assert.equal(
    (await invoke(advance, producer, { estado: "confirmada" })).code,
    409,
  );
  assert.equal(
    (await invoke(delivery, buyer, { entrega: { tipo: "entrega" } })).code,
    400,
  );
  assert.equal(
    (
      await invoke(delivery, buyer, {
        entrega: { tipo: "entrega", morada: "  Rua A  " },
      })
    ).body.estado,
    "confirmada",
  );
  assert.deepEqual(order.entrega, { tipo: "entrega", morada: "Rua A" });
  assert.deepEqual(
    events.map((item) => item.room),
    [`user:${producer}`],
  );
  assert.equal(
    (await invoke(delivery, buyer, { entrega: { tipo: "levantamento" } })).code,
    409,
  );
  assert.deepEqual(order.entrega, { tipo: "entrega", morada: "Rua A" });
});

test("ID inválido e comprador alheio não alteram a modalidade", async (t) => {
  const { order, events, invoke } = fixture(t);
  assert.equal(
    (
      await invoke(
        delivery,
        buyer,
        { entrega: { tipo: "levantamento" } },
        "invalid",
      )
    ).code,
    404,
  );
  assert.equal(
    (
      await invoke(delivery, "dca000000000000000000009", {
        entrega: { tipo: "levantamento" },
      })
    ).code,
    404,
  );
  assert.equal(order.entrega, null);
  assert.deepEqual(events, []);
});

test("Conflito concorrente ao escolher modalidade não emite notificação", async (t) => {
  const { order, events, invoke } = fixture(t);
  t.mock.method(Order, "findOneAndUpdate", async () => null);
  assert.equal(
    (
      await invoke(delivery, buyer, {
        entrega: { tipo: "entrega", morada: "Rua A" },
      })
    ).code,
    409,
  );
  assert.equal(order.estado, "pendente");
  assert.deepEqual(events, []);
});
