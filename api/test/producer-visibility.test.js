import test from "node:test";
import assert from "node:assert/strict";
import products from "../src/routes/products.js";
import producers from "../src/routes/producers.js";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";
import Review from "../src/models/Review.js";

const producerId = "dca000000000000000000004";
const productId = "dca000000000000000000065";

function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$and")
      return expected.every((condition) => matches(record, condition));
    const actual = key
      .split(".")
      .reduce((value, part) => value?.[part], record);
    return expected?.$in ? expected.$in.includes(actual) : actual === expected;
  });
}

async function invoke(router, path, id) {
  const handler = router.stack
    .find((layer) => layer.route?.path === path && layer.route.methods.get)
    .route.stack.at(-1).handle;
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
  await handler({ params: { id }, query: {} }, response, (error) => {
    throw error;
  });
  return response;
}

test("Produtos, filtros e perfil público acompanham a aprovação atual sem alterar os conteúdos", async (t) => {
  const producer = {
    _id: producerId,
    papel: "produtor",
    nome: "Quinta",
    perfilProdutor: { validacao: "pendente", localidade: "Viana" },
  };
  const product = {
    _id: productId,
    produtorId: producerId,
    nome: "Batata",
    categoria: "Hortícolas",
    publicado: true,
  };
  const original = structuredClone(product);
  let present = true;

  // Executa os filtros e matches de populate pedidos pelas rotas sobre a mesma conta.
  function query(value) {
    let population;
    return {
      select() {
        return this;
      },
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      populate(options) {
        population = options;
        return this;
      },
      async distinct(field) {
        return [...new Set(value.map((record) => record[field]))];
      },
      async lean() {
        function populate(record) {
          if (!record) return null;
          const result = structuredClone(record);
          if (population) {
            assert.equal(population.path, "produtorId");
            result.produtorId =
              present &&
              (!population.match || matches(producer, population.match))
                ? structuredClone(producer)
                : null;
          }
          return result;
        }
        return Array.isArray(value) ? value.map(populate) : populate(value);
      },
      then(resolve, reject) {
        return this.lean().then(resolve, reject);
      },
    };
  }
  t.mock.method(User, "find", (filter) =>
    query(present && matches(producer, filter) ? [producer] : []),
  );
  t.mock.method(User, "findOne", (filter) =>
    query(present && matches(producer, filter) ? producer : null),
  );
  t.mock.method(Product, "find", (filter) =>
    query(matches(product, filter) ? [product] : []),
  );
  t.mock.method(Product, "findOne", (filter) =>
    query(matches(product, filter) ? product : null),
  );
  t.mock.method(Product, "countDocuments", async (filter) =>
    matches(product, filter) ? 1 : 0,
  );
  t.mock.method(Product, "distinct", (field, filter) =>
    query(matches(product, filter) ? [product] : []).distinct(field),
  );
  t.mock.method(Product, "aggregate", async () => []);
  t.mock.method(Review, "aggregate", async () => []);
  t.mock.method(Review, "find", () => query([]));
  for (const model of [User, Product]) {
    for (const method of ["create", "findOneAndUpdate", "findOneAndDelete"]) {
      t.mock.method(model, method, () => {
        throw new Error("Consulta pública não deve escrever.");
      });
    }
  }

  for (const state of [
    "pendente",
    "aceite",
    "rejeitado",
    "aceite",
    "outro-papel",
    "removido",
  ]) {
    producer.perfilProdutor.validacao = ["outro-papel", "removido"].includes(
      state,
    )
      ? "aceite"
      : state;
    producer.papel = state === "outro-papel" ? "comprador" : "produtor";
    present = state !== "removido";
    const visible = state === "aceite";
    const before = structuredClone(producer);
    const catalog = (await invoke(products, "/")).body;
    assert.equal(catalog.items.length, visible ? 1 : 0, state);
    assert.equal(catalog.total, visible ? 1 : 0, state);
    assert.equal(
      (await invoke(products, "/:id", productId)).code,
      visible ? 200 : 404,
      state,
    );
    const filters = (await invoke(products, "/filters")).body;
    assert.equal(filters.produtores.length, visible ? 1 : 0, state);
    assert.deepEqual(filters.categorias, visible ? ["Hortícolas"] : [], state);
    assert.deepEqual(filters.localidades, visible ? ["Viana"] : [], state);
    assert.equal(
      (await invoke(producers, "/")).body.length,
      visible ? 1 : 0,
      state,
    );
    const profile = await invoke(producers, "/:id", producerId);
    assert.equal(profile.code, visible ? 200 : 404, state);
    if (visible) assert.equal(profile.body.produtos[0]._id, productId);
    assert.deepEqual(product, original);
    assert.deepEqual(producer, before);
  }
});
