import test from "node:test";
import assert from "node:assert/strict";
import router from "../src/routes/products.js";
import Product from "../src/models/Product.js";
import User from "../src/models/User.js";
import Review from "../src/models/Review.js";

const handler = router.stack.find((layer) => layer.route?.path === "/:id").route
  .stack[0].handle;
const id = "dca000000000000000000065";
async function invoke(value = id) {
  let status = 200,
    body;
  const response = {
    status(code) {
      status = code;
      return this;
    },
    json(data) {
      body = data;
    },
  };
  await handler({ params: { id: value } }, response, (error) => {
    throw error;
  });
  return { status, body };
}

test("Detalhe carrega só o produtor do produto e mantém a resposta pública", async (t) => {
  t.mock.method(Review, "aggregate", async () => []);
  const product = {
    _id: id,
    nome: "Batata",
    produtorId: {
      _id: "producer",
      nome: "Quinta",
      perfilProdutor: { localidade: "Viana" },
    },
  };
  t.mock.method(User, "find", () => {
    throw new Error("Não deve listar produtores.");
  });
  t.mock.method(Product, "findOne", (filter) => {
    assert.deepEqual(filter, {
      _id: id,
      publicado: true,
      bloqueado: { $ne: true },
    });
    return {
      select(fields) {
        assert.equal(fields, "-imagens");
        return this;
      },
      populate(options) {
        assert.equal(options.path, "produtorId");
        assert.deepEqual(options.match, {
          papel: "produtor",
          "perfilProdutor.validacao": "aceite",
        });
        assert.equal(options.select.includes("passwordHash"), false);
        return { lean: async () => product };
      },
    };
  });
  assert.deepEqual(await invoke(), {
    status: 200,
    body: { ...product, avaliacao: { media: null, total: 0 } },
  });
});

for (const reason of [
  "produto inexistente ou privado",
  "produtor pendente",
  "produtor rejeitado",
  "produtor removido",
]) {
  test(`Detalhe devolve 404 para ${reason}`, async (t) => {
    t.mock.method(Product, "findOne", () => ({
      select() {
        return this;
      },
      populate: () => ({
        lean: async () =>
          reason.startsWith("produto") ? null : { _id: id, produtorId: null },
      }),
    }));
    assert.equal((await invoke()).status, 404);
  });
}

test("ID inválido devolve 400 sem consultar MongoDB", async (t) => {
  t.mock.method(Product, "findOne", () => {
    throw new Error("Não consultar.");
  });
  assert.deepEqual(await invoke("invalid"), {
    status: 400,
    body: { erro: "ID de produto inválido." },
  });
});
