import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import {
  User,
  Product,
  Review,
  initializeCollections,
} from "../src/models/index.js";
import { seedData, seedId } from "../src/scripts/seed-data.js";
import reviews from "../src/routes/reviews.js";
import admin from "../src/routes/admin.js";
import { withProductRatings } from "../src/services/reviews.js";

test(
  "MongoDB real: denúncias atómicas, médias, privacidade e moderação concorrente",
  {
    skip:
      !process.env.MONGODB_TEST_URI &&
      "Configura MONGODB_TEST_URI para uma base de testes isolada.",
  },
  async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI, {
      dbName: `codex_reviews_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
      serverSelectionTimeoutMS: 10000,
    });
    try {
      await initializeCollections();
      const index = (await Review.collection.indexes()).find(
        (item) => item.name === "review_author_order_target_unique",
      );
      assert.equal(index.unique, true);
      const fixtures = seedData("$2b$04$" + "a".repeat(53));
      await User.insertMany(fixtures.find(([model]) => model === User)[1]);
      const product = await Product.create(
        fixtures.find(([model]) => model === Product)[1][0],
      );
      const review = await Review.create({
        autorId: seedId(2),
        encomendaId: seedId(201),
        produtoId: product._id,
        classificacao: 4,
        comentario: "Original",
        updatedAt: new Date(),
      });
      // Documento anterior às denúncias, sem o campo gravado na coleção.
      const legacy = await Review.collection.insertOne({
        autorId: seedId(2),
        encomendaId: seedId(202),
        produtoId: product._id,
        classificacao: 5,
        comentario: "Avaliação antiga",
        estado: "oculta",
      });
      async function consultAdmin(id) {
        const path = id ? "/:resource/:id" : "/:resource";
        const handler = admin.stack
          .find(
            (layer) => layer.route?.path === path && layer.route.methods.get,
          )
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
          {
            params: { resource: "reviews", ...(id ? { id: String(id) } : {}) },
            query: {},
          },
          response,
          (error) => {
            throw error;
          },
        );
        assert.equal(response.code, 200);
        return response.body;
      }
      assert.equal((await consultAdmin()).total, 2);
      assert.deepEqual((await consultAdmin(legacy.insertedId)).denuncias, []);
      async function invoke(path, body, user = seedId(3)) {
        const handler = reviews.stack
          .find((layer) => layer.route?.path === path)
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
          {
            params: { id: String(review._id) },
            body,
            user: { id: String(user) },
          },
          response,
          (error) => {
            throw error;
          },
        );
        return response;
      }
      assert.deepEqual((await withProductRatings([product]))[0].avaliacao, {
        media: 4,
        total: 1,
      });
      const initial = (
        await Review.findById(review._id)
      ).updatedAt.toISOString();
      const reasons = ["$literal motivo", "$literal duplicada"];
      const responses = await Promise.all(
        reasons.map((motivo) => invoke("/:id/denuncias", { motivo })),
      );
      assert.deepEqual(responses.map((item) => item.code).sort(), [201, 409]);
      const acceptedReason =
        reasons[responses.findIndex(({ code }) => code === 201)];
      assert.equal(
        (await invoke("/:id/denuncias", { motivo: "Produtor" }, seedId(4)))
          .code,
        201,
      );
      assert.deepEqual((await withProductRatings([product]))[0].avaliacao, {
        media: null,
        total: 0,
      });
      const stored = await Review.findById(review._id).select("+denuncias");
      assert.equal(stored.denuncias.length, 2);
      assert.equal(stored.denuncias[0].motivo, acceptedReason);
      const administrative = await consultAdmin(review._id);
      assert.equal(administrative.totalDenuncias, 2);
      assert.equal(administrative.denuncias[0].motivo, acceptedReason);
      assert.equal(
        administrative.denuncias[0].autorId.nome,
        "Restaurante Demo",
      );
      assert.equal(
        (await consultAdmin()).items.find(
          (item) => String(item._id) === String(review._id),
        ).totalDenuncias,
        2,
      );
      assert.equal(JSON.parse(JSON.stringify(stored)).denuncias, undefined);
      assert.equal(
        (
          await invoke(
            "/:id/moderacao",
            { estado: "publicada", atualizadoEm: initial },
            seedId(1),
          )
        ).code,
        409,
      );
      assert.equal(
        (
          await invoke(
            "/:id/moderacao",
            {
              estado: "publicada",
              atualizadoEm: stored.updatedAt.toISOString(),
            },
            seedId(1),
          )
        ).code,
        200,
      );
      assert.deepEqual((await withProductRatings([product]))[0].avaliacao, {
        media: 4,
        total: 1,
      });
      assert.equal(
        (await invoke("/:id/denuncias", { motivo: "Repetida após moderação" }))
          .code,
        409,
      );
      assert.equal(
        (await Review.findById(review._id).select("+denuncias")).denuncias
          .length,
        2,
      );
      await User.deleteOne({ _id: seedId(3) });
      const removedAuthor = await consultAdmin(review._id);
      assert.equal(removedAuthor.denuncias[0].autorId, null);
      assert.equal(removedAuthor.totalDenuncias, 2);
    } finally {
      try {
        await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  },
);
