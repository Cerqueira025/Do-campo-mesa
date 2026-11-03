import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import reviews from "../src/routes/reviews.js";
import Product from "../src/models/Product.js";
import User from "../src/models/User.js";
import Review from "../src/models/Review.js";
import {
  publicReviewFields,
  withProductRatings,
} from "../src/services/reviews.js";

const productId = "dca000000000000000000065";
const otherProductId = "dca000000000000000000066";
const producerId = "dca000000000000000000004";
const reviewId = "dca000000000000000000201";
const authorId = "dca000000000000000000002";
const reporterId = "dca000000000000000000003";

async function invoke(
  path,
  method,
  { id = reviewId, body = {}, userId = reporterId } = {},
) {
  const handler = reviews.stack
    .find((layer) => layer.route?.path === path && layer.route.methods[method])
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
  await handler(
    { params: { id }, body, user: { id: userId } },
    response,
    (error) => {
      throw error;
    },
  );
  return response;
}

function publicProduct(t, available = true) {
  t.mock.method(Product, "findOne", (filter) => {
    assert.equal(filter.publicado, true);
    assert.deepEqual(filter.bloqueado, { $ne: true });
    const query = {
      select() {
        return this;
      },
      populate(options) {
        assert.deepEqual(options.match, {
          papel: "produtor",
          "perfilProdutor.validacao": "aceite",
        });
        return this;
      },
      lean: async () =>
        available ? { produtorId: { _id: producerId } } : null,
    };
    return query;
  });
}

test("Resumos de vários produtos usam uma agregação, apenas notas públicas, e preservam os produtos", async (t) => {
  const products = [
    { _id: productId, nome: "Batata" },
    new Product({ _id: otherProductId, nome: "Mel" }),
  ];
  const original = structuredClone(products[0]);
  const aggregate = t.mock.method(Review, "aggregate", async (pipeline) => {
    assert.deepEqual(pipeline[0].$match.produtoId.$in.map(String), [
      productId,
      otherProductId,
    ]);
    assert.equal(pipeline[0].$match.estado, "publicada");
    return [
      { _id: new mongoose.Types.ObjectId(productId), media: 14 / 3, total: 3 },
    ];
  });
  const result = await withProductRatings(products);
  assert.deepEqual(result[0].avaliacao, { media: 4.67, total: 3 });
  assert.deepEqual(result[1].avaliacao, { media: null, total: 0 });
  assert.deepEqual(products[0], original);
  assert.equal(aggregate.mock.callCount(), 1);
  assert.deepEqual(await withProductRatings([]), []);
  assert.equal(aggregate.mock.callCount(), 1);
});

for (const [path, field, id] of [
  ["/products/:id", "produtoId", productId],
  ["/producers/:id", "produtorId", producerId],
]) {
  test(`Consulta ${path} limita os campos públicos e ordena de forma estável`, async (t) => {
    publicProduct(t);
    t.mock.method(User, "exists", async (filter) => {
      assert.equal(filter["perfilProdutor.validacao"], "aceite");
      assert.equal(filter.papel, "produtor");
      return { _id: producerId };
    });
    t.mock.method(Review, "find", (filter) => {
      assert.equal(String(filter[field]), id);
      assert.equal(filter.estado, "publicada");
      return {
        select(fields) {
          assert.equal(fields, publicReviewFields);
          assert.doesNotMatch(fields, /encomenda|denuncias|ultimaDecisao/);
          return this;
        },
        sort(value) {
          assert.deepEqual(value, { createdAt: -1, _id: -1 });
          return this;
        },
        populate: async () => [],
      };
    });
    t.mock.method(Review, "aggregate", async () => []);
    assert.deepEqual((await invoke(path, "get", { id })).body, {
      items: [],
      media: null,
      total: 0,
    });
  });
}

test("Consultas públicas recusam produto e produtor indisponíveis antes de ler avaliações", async (t) => {
  publicProduct(t, false);
  t.mock.method(User, "exists", async () => null);
  t.mock.method(Review, "find", () => {
    throw new Error("Não deve ler avaliações");
  });
  assert.equal(
    (await invoke("/products/:id", "get", { id: productId })).code,
    404,
  );
  assert.equal(
    (await invoke("/producers/:id", "get", { id: producerId })).code,
    404,
  );
  assert.equal(
    (await invoke("/products/:id", "get", { id: "invalido" })).code,
    404,
  );
});

function reportFixture(t) {
  publicProduct(t);
  const review = new Review({
    _id: reviewId,
    autorId: authorId,
    encomendaId: "dca0000000000000000000c9",
    produtoId: productId,
    classificacao: 4,
    comentario: "Original",
    estado: "publicada",
    updatedAt: new Date("2026-01-01"),
  });
  t.mock.method(Review, "findById", async () => review);
  t.mock.method(
    Review,
    "findOneAndUpdate",
    async (filter, pipeline, options) => {
      assert.equal(options.updatePipeline, true);
      assert.equal(options.timestamps, false);
      if (
        !filter.estado.$in.includes(review.estado) ||
        review.denuncias.some(
          (item) => String(item.autorId) === filter["denuncias.autorId"].$ne,
        )
      )
        return null;
      const update = pipeline[0].$set;
      const report = update.denuncias.$concatArrays[1][0];
      assert.deepEqual(update.denuncias.$concatArrays[0], {
        $ifNull: ["$denuncias", []],
      });
      assert.equal(report.data, "$$NOW");
      assert.equal(update.updatedAt.$max[1].$add[1], 1);
      review.denuncias.push({
        autorId: report.autorId,
        motivo: report.motivo.$literal,
        data: new Date(),
      });
      review.estado = update.estado;
      review.updatedAt = new Date(
        Math.max(Date.now(), review.updatedAt.getTime() + 1),
      );
      return review;
    },
  );
  return review;
}

test("Denúncias concorrentes da mesma conta só gravam uma; outras contas podem denunciar", async (t) => {
  const review = reportFixture(t);
  const data = { body: { motivo: "  $motivo com espaços  " } };
  assert.deepEqual(
    (
      await Promise.all([
        invoke("/:id/denuncias", "post", data),
        invoke("/:id/denuncias", "post", data),
      ])
    )
      .map((item) => item.code)
      .sort(),
    [201, 409],
  );
  assert.equal(review.estado, "denunciada");
  assert.equal(review.denuncias.length, 1);
  assert.equal(review.denuncias[0].motivo, "$motivo com espaços");
  assert.equal(
    (await invoke("/:id/denuncias", "post", { ...data, userId: producerId }))
      .code,
    201,
  );
  assert.equal(review.denuncias.length, 2);
  review.estado = "publicada";
  assert.equal((await invoke("/:id/denuncias", "post", data)).code, 409);
  assert.equal(review.comentario, "Original");
  assert.equal(review.classificacao, 4);
});

test("Denúncia valida motivo, propriedade, disponibilidade e estado", async (t) => {
  const review = reportFixture(t);
  for (const motivo of [undefined, null, 5, "", "   ", "x".repeat(501)])
    assert.equal(
      (await invoke("/:id/denuncias", "post", { body: { motivo } })).code,
      400,
    );
  const data = { body: { motivo: "Conteúdo inadequado" } };
  assert.equal(
    (await invoke("/:id/denuncias", "post", { ...data, id: "invalid" })).code,
    404,
  );
  assert.equal(
    (await invoke("/:id/denuncias", "post", { ...data, userId: authorId }))
      .code,
    403,
  );
  review.estado = "oculta";
  assert.equal((await invoke("/:id/denuncias", "post", data)).code, 409);
  t.mock.method(Product, "findOne", () => ({
    select() {
      return this;
    },
    populate() {
      return this;
    },
    lean: async () => null,
  }));
  assert.equal((await invoke("/:id/denuncias", "post", data)).code, 404);
  t.mock.method(Review, "findById", async () => null);
  assert.equal((await invoke("/:id/denuncias", "post", data)).code, 404);
  assert.equal(review.denuncias.length, 0);
});

test("Denúncias e motivos administrativos permanecem privados na serialização normal", async (t) => {
  const review = reportFixture(t);
  await invoke("/:id/denuncias", "post", { body: { motivo: "Privado" } });
  review.ultimaDecisao = {
    administradorId: producerId,
    motivo: "Privado também",
    data: new Date(),
  };
  const json = JSON.parse(JSON.stringify(review));
  assert.equal(json.denuncias, undefined);
  assert.equal(json.ultimaDecisao, undefined);
  assert.equal(Review.schema.path("denuncias").options.select, false);
});

test("Moderação desatualizada após denúncia devolve 409 e conserva a avaliação", async (t) => {
  const review = reportFixture(t);
  const observed = review.updatedAt.toISOString();
  await invoke("/:id/denuncias", "post", { body: { motivo: "Analisar" } });
  t.mock.method(Review, "findOneAndUpdate", (filter, update) => ({
    populate: async () => {
      if (filter.updatedAt?.getTime() !== review.updatedAt.getTime())
        return null;
      review.set(update.$set);
      return review;
    },
  }));
  t.mock.method(Review, "exists", async () => ({ _id: reviewId }));
  const data = { body: { estado: "publicada", atualizadoEm: observed } };
  assert.equal((await invoke("/:id/moderacao", "patch", data)).code, 409);
  assert.equal(review.estado, "denunciada");
  data.body.atualizadoEm = review.updatedAt.toISOString();
  assert.equal((await invoke("/:id/moderacao", "patch", data)).code, 200);
  assert.equal(review.denuncias.length, 1);
  assert.equal(review.estado, "publicada");
  assert.equal(review.classificacao, 4);
  assert.equal(
    (
      await invoke("/:id/moderacao", "patch", {
        body: { estado: "publicada", atualizadoEm: null },
      })
    ).code,
    400,
  );
});

test("HTTP permite denúncias a compradores e produtores, exige sessão e protege dados administrativos", async (t) => {
  reportFixture(t);
  process.env.JWT_SECRET = "public-reviews-test-secret-at-least-32-characters";
  let role = "comprador";
  t.mock.method(User, "findById", () => ({
    select: async () => ({ id: reporterId, papel: role }),
  }));
  const token = jwt.sign({ id: reporterId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (authenticated = true) =>
    fetch(`${base}/reviews/${reviewId}/denuncias`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ motivo: "Analisar" }),
    });
  assert.equal((await request(false)).status, 401);
  role = "administrador";
  assert.equal((await request()).status, 403);
  role = "comprador";
  assert.equal((await request()).status, 201);
  assert.equal(
    (
      await fetch(`${base}/admin/reviews/${reviewId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status,
    403,
  );
  role = "produtor";
  assert.equal((await request()).status, 409);
});
