import test from "node:test";
import assert from "node:assert/strict";
import router from "../src/routes/products.js";
import Product from "../src/models/Product.js";
import User from "../src/models/User.js";
import Review from "../src/models/Review.js";

const handler = (path) =>
  router.stack.find((layer) => layer.route?.path === path).route.stack[0]
    .handle;
const invoke = async (path, query = {}) => {
  let body;
  await handler(path)(
    { query },
    {
      json: (data) => {
        body = data;
      },
    },
    (error) => {
      throw error;
    },
  );
  return body;
};

test("Opções incluem todo o catálogo público, sem produtos privados, produtores pendentes ou sem produtos", async (t) => {
  const producers = [
    { _id: "a", nome: "Quinta A", perfilProdutor: { localidade: "Viana" } },
    { _id: "b", nome: "Quinta B", perfilProdutor: { localidade: "Viana" } },
    { _id: "c", nome: "Sem produtos", perfilProdutor: { localidade: "Porto" } },
  ];
  const products = [
    ...Array.from({ length: 24 }, () => ({
      produtorId: "a",
      categoria: "Mel",
      publicado: true,
    })),
    { produtorId: "b", categoria: "Fruta", publicado: true },
    { produtorId: "a", categoria: "Privada", publicado: false },
    { produtorId: "pendente", categoria: "Pendente", publicado: true },
  ];
  t.mock.method(User, "find", (filter) => {
    assert.deepEqual(filter, {
      papel: "produtor",
      "perfilProdutor.validacao": "aceite",
    });
    return { select: () => ({ lean: async () => producers }) };
  });
  t.mock.method(Product, "distinct", async (field, filter) => {
    const visible = products.filter(
      (product) =>
        product.publicado === filter.publicado &&
        filter.produtorId.$in.includes(product.produtorId),
    );
    return [...new Set(visible.map((product) => product[field]))];
  });
  assert.deepEqual(await invoke("/filters"), {
    categorias: ["Fruta", "Mel"],
    produtores: [
      { id: "a", nome: "Quinta A" },
      { id: "b", nome: "Quinta B" },
    ],
    localidades: ["Viana"],
  });
});

test("Catálogo vazio devolve opções vazias", async (t) => {
  t.mock.method(User, "find", () => ({
    select: () => ({ lean: async () => [] }),
  }));
  t.mock.method(Product, "distinct", async () => []);
  assert.deepEqual(await invoke("/filters"), {
    categorias: [],
    produtores: [],
    localidades: [],
  });
});

test("Estações incluem todo o ano e bio=false mantém a restrição não biológica", async (t) => {
  let captured;
  t.mock.method(User, "find", () => ({ distinct: async () => [] }));
  t.mock.method(Product, "find", (filter) => {
    captured = filter;
    const chain = {
      select: () => chain,
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      populate: async () => [],
    };
    return chain;
  });
  t.mock.method(Product, "countDocuments", async () => 0);
  for (const epoca of ["primavera", "verao", "outono", "inverno"]) {
    await invoke("/", { epoca, bio: "false", categoria: "Fruta", q: "maçã" });
    assert.deepEqual(captured.epoca, { $in: [epoca, "todo-o-ano"] });
    assert.equal(captured.biologico, false);
    assert.equal(captured.categoria, "Fruta");
    assert.equal(captured.$and.length, 2);
  }
  await invoke("/", { epoca: "todo-o-ano" });
  assert.equal(captured.epoca, "todo-o-ano");
  assert.equal(captured.biologico, undefined);
});

test("Avaliação mínima usa a média pública do produto e combina com os restantes filtros", async (t) => {
  let captured;
  t.mock.method(User, "find", () => ({ distinct: async () => [] }));
  t.mock.method(Review, "aggregate", async (pipeline) => {
    assert.deepEqual(pipeline, [
      { $match: { estado: "publicada", produtoId: { $ne: null } } },
      { $group: { _id: "$produtoId", media: { $avg: "$classificacao" } } },
      { $match: { media: { $gte: 4.5 } } },
    ]);
    return [{ _id: "produto-avaliado", media: 4.5 }];
  });
  t.mock.method(Product, "find", (filter) => {
    captured = filter;
    const chain = {
      select: () => chain,
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      populate: async () => [],
    };
    return chain;
  });
  t.mock.method(Product, "countDocuments", async (filter) => {
    assert.deepEqual(filter._id, { $in: ["produto-avaliado"] });
    return 0;
  });
  await invoke("/", {
    avaliacaoMin: "4.5",
    categoria: "Fruta",
    bio: "false",
    epoca: "outono",
  });
  assert.deepEqual(captured._id, { $in: ["produto-avaliado"] });
  assert.equal(captured.categoria, "Fruta");
  assert.equal(captured.biologico, false);
  assert.deepEqual(captured.epoca, { $in: ["outono", "todo-o-ano"] });
});

test("Rejeita classificações mínimas inválidas antes de consultar a base de dados", async () => {
  for (const avaliacaoMin of ["", "0", "6", "abc", ["4", "5"]]) {
    let status;
    await handler("/")(
      { query: { avaliacaoMin } },
      {
        status: (code) => {
          status = code;
          return { json: () => {} };
        },
      },
      (error) => {
        throw error;
      },
    );
    assert.equal(status, 400);
  }
});
