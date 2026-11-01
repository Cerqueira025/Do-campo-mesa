import test from "node:test";
import assert from "node:assert/strict";
import router from "../src/routes/reviews.js";
import Order from "../src/models/Order.js";
import Review from "../src/models/Review.js";

const handler = router.stack
  .find((layer) => layer.route?.methods.post)
  .route.stack.at(-1).handle;
const buyerId = "dca000000000000000000002";
const producerId = "dca000000000000000000004";
const productId = "dca000000000000000000065";
const otherProductId = "dca000000000000000000066";
const orderId = "dca0000000000000000000c9";
const otherOrderId = "dca0000000000000000000ca";
const body = {
  encomendaId: orderId,
  produtoId: productId,
  classificacao: 5,
  comentario: "Original",
};
const duplicateMessage = { erro: "Já avaliou este alvo nesta encomenda." };
const uniqueKey = { autorId: 1, encomendaId: 1, produtoId: 1, produtorId: 1 };

async function invoke(data = body, userId = buyerId) {
  const response = {
    code: 200,
    status(code) {
      this.code = code;
      return this;
    },
    location(url) {
      this.url = url;
      return this;
    },
    json(value) {
      this.body = value;
    },
  };
  await handler({ body: data, user: { id: userId } }, response, (error) => {
    response.error = error;
  });
  return response;
}

function setup(t) {
  const orders = [orderId, otherOrderId].map((id) => ({
    id,
    compradorId: buyerId,
    produtorId: producerId,
    estado: "entregue",
    linhas: [{ produtoId: productId }, { produtoId: otherProductId }],
  }));
  const records = new Map();
  t.mock.method(
    Order,
    "findOne",
    async (filter) =>
      orders.find(
        (order) =>
          order.id === filter._id &&
          order.compradorId === filter.compradorId &&
          order.estado === filter.estado,
      ) ?? null,
  );
  // Simula a restrição única; a concorrência real depende do índice criado no MongoDB.
  const create = t.mock.method(Review, "create", async (data) => {
    const document = new Review(data);
    await document.validate();
    const key = JSON.stringify(
      Object.keys(uniqueKey).map((field) => document[field] ?? null),
    );
    if (records.has(key))
      throw Object.assign(new Error("Duplicado"), {
        code: 11000,
        keyPattern: uniqueKey,
      });
    records.set(key, document);
    document.populate = async () => document;
    return document;
  });
  return { records, orders, create };
}

test("Declara índice único por autor, encomenda e alvo, independentemente da moderação", () => {
  const index = Review.schema
    .indexes()
    .find(
      ([, options]) => options.name === "review_author_order_target_unique",
    );
  assert.ok(index);
  assert.deepEqual(index[0], uniqueKey);
  assert.equal(index[1].unique, true);
  assert.equal(index[1].sparse, undefined);
  assert.equal(index[1].partialFilterExpression, undefined);
});

for (const target of [{ produtoId: productId }, { produtorId: producerId }]) {
  for (const estado of ["publicada", "oculta", "denunciada"]) {
    test(`Recusa repetição de ${Object.keys(target)[0]} em estado ${estado} e preserva a original`, async (t) => {
      const fixture = setup(t);
      const data = {
        encomendaId: orderId,
        ...target,
        classificacao: 5,
        comentario: "Original",
      };
      const first = await invoke(data);
      assert.equal(first.code, 201);
      assert.equal(first.url, `/api/reviews/${first.body.id}`);
      first.body.estado = estado;
      const original = first.body.toObject();
      const repeated = await invoke({
        ...data,
        classificacao: 1,
        comentario: "Substituição",
      });
      assert.equal(repeated.code, 409);
      assert.deepEqual(repeated.body, duplicateMessage);
      assert.equal(fixture.records.size, 1);
      assert.deepEqual(first.body.toObject(), original);
    });
  }
}

test("Permite avaliar produtos diferentes e o produtor da mesma encomenda, e repetir numa compra nova", async (t) => {
  const fixture = setup(t);
  for (const encomendaId of [orderId, otherOrderId]) {
    for (const target of [
      { produtoId: productId },
      { produtoId: otherProductId },
      { produtorId: producerId },
    ]) {
      const result = await invoke({
        encomendaId,
        ...target,
        classificacao: 4,
        comentario: "Compra entregue",
      });
      assert.equal(result.code, 201);
      assert.equal(result.body.autorId.toString(), buyerId);
      assert.equal(result.body.estado, "publicada");
    }
  }
  assert.equal(fixture.records.size, 6);
});

test("Dois pedidos simultâneos recebem 201 e 409 quando a persistência recusa a chave repetida", async (t) => {
  const fixture = setup(t);
  const responses = await Promise.all([invoke(), invoke()]);
  assert.deepEqual(responses.map((result) => result.code).sort(), [201, 409]);
  assert.equal(fixture.records.size, 1);
});

test("Recusa encomenda alheia, não entregue ou inexistente antes de escrever", async (t) => {
  const fixture = setup(t);
  assert.equal((await invoke(body, producerId)).code, 400);
  for (const estado of ["pendente", "confirmada", "pronta"]) {
    fixture.orders[0].estado = estado;
    assert.equal((await invoke()).code, 400);
  }
  assert.equal(
    (await invoke({ ...body, encomendaId: "dca000000000000000009999" })).code,
    400,
  );
  assert.equal(fixture.create.mock.callCount(), 0);
});

test("Recusa alvo fora da encomenda, ambos os alvos ou nenhum alvo antes de escrever", async (t) => {
  const fixture = setup(t);
  for (const change of [
    { produtoId: "dca000000000000000009999" },
    { produtoId: "invalido" },
    { produtoId: undefined, produtorId: buyerId },
    { produtoId: undefined, produtorId: "invalido" },
    { produtorId: producerId },
    { produtoId: undefined },
  ])
    assert.equal((await invoke({ ...body, ...change })).code, 400);
  assert.equal((await invoke(null)).code, 400);
  assert.equal(fixture.create.mock.callCount(), 0);
});

test("Mantém validação de classificação, comentário e alvo único no schema", async (t) => {
  const fixture = setup(t);
  for (const change of [
    { classificacao: 0 },
    { classificacao: 6 },
    { classificacao: 2.5 },
    { comentario: "" },
  ]) {
    assert.equal(
      (await invoke({ ...body, ...change })).error?.name,
      "ValidationError",
    );
  }
  assert.equal(fixture.records.size, 0);
});

test("Conflitos de outros índices não recebem a mensagem de avaliação repetida", async (t) => {
  setup(t);
  const error = Object.assign(new Error("Outro índice"), {
    code: 11000,
    keyPattern: { _id: 1 },
  });
  t.mock.method(Review, "create", async () => {
    throw error;
  });
  assert.equal((await invoke()).error, error);
});
