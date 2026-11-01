import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import {
  Auction,
  Product,
  User,
  Order,
  initializeCollections,
} from "../src/models/index.js";
import { seedData } from "../src/scripts/seed-data.js";
import { processAuctionStock } from "../src/services/auctionStock.js";
import orders from "../src/routes/orders.js";
import auctions from "../src/routes/auctions.js";
import products from "../src/routes/products.js";

test(
  "Concorrência real MongoDB: leilões, encomendas e repetição",
  {
    skip:
      !process.env.MONGODB_TEST_URI &&
      "Configura MONGODB_TEST_URI para um replica set de testes.",
  },
  async (t) => {
    const dbName = `codex_stock_test_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    await mongoose.connect(process.env.MONGODB_TEST_URI, {
      dbName,
      serverSelectionTimeoutMS: 10000,
    });
    try {
      await initializeCollections();
      const fixtures = seedData("$2b$04$" + "a".repeat(53));
      const users = fixtures.find(([model]) => model === User)[1];
      await User.insertMany(users.slice(0, 4));
      const product = await Product.create(
        fixtures.find(([model]) => model === Product)[1][0],
      );
      const now = Date.now();
      const productTemplate = fixtures.find(
        ([model]) => model === Product,
      )[1][0];
      async function freshProduct() {
        const data = { ...productTemplate };
        delete data._id;
        return Product.create({ ...data, stock: 10 });
      }
      async function invoke(
        router,
        method,
        body,
        id,
        owner = product.produtorId,
      ) {
        const handler = router.stack
          .find(
            (layer) =>
              layer.route?.methods[method] &&
              (method !== "patch" || layer.route.path === "/:id/estado"),
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
          location() {
            return this;
          },
          end() {},
        };
        await handler(
          { body, params: { id }, user: { id: String(owner) } },
          response,
          (error) => {
            if (!error.status) throw error;
            response.code = error.status;
          },
        );
        return response;
      }
      const auctionBody = (item) => ({
        produtos: [{ produtoId: item.id, quantidade: 1 }],
        lote: "Concorrência criação/eliminação",
        precoBase: 100,
        incremento: 10,
        dataInicio: new Date().toISOString(),
        dataFim: new Date(Date.now() + 60000).toISOString(),
      });
      const lot = () => ({
        produtorId: product.produtorId,
        produtos: [{ produtoId: product._id, quantidade: 6, unidade: "kg" }],
        lote: "Lote concorrente",
        precoBase: 100,
        incremento: 10,
        dataInicio: new Date(now - 1000),
        dataFim: new Date(now + 60000),
        estado: "agendado",
        reservaStock: "pendente",
        licitacaoAtual: { valor: 100, compradorId: null },
      });

      await t.test("Dois leilões não reservam as mesmas unidades", async () => {
        await Product.updateOne({ _id: product._id }, { $set: { stock: 10 } });
        const [a, b] = await Auction.create([lot(), lot()]);
        await Promise.all([
          processAuctionStock(a.id, now),
          processAuctionStock(b.id, now),
          processAuctionStock(a.id, now),
        ]);
        assert.equal((await Product.findById(product._id)).stock, 4);
        assert.equal(
          await Auction.countDocuments({ reservaStock: "reservada" }),
          1,
        );
        assert.equal(await Auction.countDocuments({ estado: "cancelado" }), 1);
        await Promise.all([
          processAuctionStock(a.id, now + 60000),
          processAuctionStock(a.id, now + 60000),
          processAuctionStock(b.id, now + 60000),
        ]);
        assert.equal((await Product.findById(product._id)).stock, 10);
      });

      await t.test(
        "Uma encomenda concorre com o leilão sem stock negativo",
        async () => {
          await Product.updateOne(
            { _id: product._id },
            { $set: { stock: 10 } },
          );
          const auction = await Auction.create(lot());
          const handler = orders.stack
            .find((layer) => layer.route?.methods.post)
            .route.stack.at(-1).handle;
          let orderError, orderStatus;
          const response = {
            status(value) {
              orderStatus = value;
              return this;
            },
            location() {
              return this;
            },
            json() {},
          };
          await Promise.all([
            processAuctionStock(auction.id, now),
            handler(
              {
                user: { id: String(users[1]._id) },
                body: {
                  linhas: [{ produtoId: product.id, quantidade: 6 }],
                  entrega: { tipo: "levantamento" },
                },
              },
              response,
              (error) => {
                orderError = error;
              },
            ),
          ]);
          assert.equal((await Product.findById(product._id)).stock, 4);
          const reserved =
            (await Auction.findById(auction._id)).reservaStock === "reservada";
          assert.equal(
            reserved ? orderError?.status : orderStatus,
            reserved ? 409 : 201,
          );
        },
      );

      await t.test(
        "Criar e apagar em ambas as ordens preserva as referências",
        async () => {
          const item = await freshProduct();
          const timestamp = item.updatedAt.getTime();
          assert.equal(
            (await invoke(auctions, "post", auctionBody(item))).code,
            201,
          );
          assert.equal(
            (await invoke(products, "delete", undefined, item.id)).code,
            409,
          );
          assert.equal(
            (await Product.findById(item.id)).updatedAt.getTime(),
            timestamp,
          );
          assert.equal(
            (await Product.findById(item.id)).revisaoLeiloes,
            undefined,
          );
          const deleted = await freshProduct();
          assert.equal(
            (await invoke(products, "delete", undefined, deleted.id)).code,
            204,
          );
          assert.equal(
            (await invoke(auctions, "post", auctionBody(deleted))).code,
            404,
          );
        },
      );

      await t.test(
        "Criação e eliminação simultâneas nunca confirmam uma referência órfã",
        async () => {
          for (let index = 0; index < 6; index++) {
            const item = await freshProduct();
            const [created, deleted] = await Promise.all([
              invoke(auctions, "post", auctionBody(item)),
              invoke(products, "delete", undefined, item.id),
            ]);
            assert.ok(
              (created.code === 201 && deleted.code === 409) ||
                (created.code === 404 && deleted.code === 204),
            );
            const linked = await Auction.exists({
              "produtos.produtoId": item._id,
            });
            assert.equal(
              Boolean(await Product.exists({ _id: item._id })),
              Boolean(linked),
            );
          }
        },
      );

      await t.test(
        "Falha na última linha reverte todas as revisões do lote",
        async () => {
          const [a, b] = await Promise.all([freshProduct(), freshProduct()]);
          const response = await invoke(auctions, "post", {
            ...auctionBody(a),
            produtos: [
              { produtoId: a.id, quantidade: 1 },
              { produtoId: b.id, quantidade: 11 },
            ],
          });
          assert.equal(response.code, 400);
          for (const item of [a, b]) {
            const saved = await Product.findById(item.id).select(
              "+revisaoLeiloes",
            );
            assert.equal(saved.revisaoLeiloes, 0);
            assert.equal(saved.stock, 10);
            assert.equal(
              await Auction.countDocuments({ "produtos.produtoId": item._id }),
              0,
            );
          }
        },
      );

      await t.test(
        "Reserva concorre com edição de stock sem perder quantidades",
        async () => {
          const item = await freshProduct();
          const auction = await Auction.create({
            ...lot(),
            produtos: [
              { produtoId: item._id, quantidade: 6, unidade: item.unidade },
            ],
          });
          const [edited] = await Promise.all([
            invoke(products, "put", { stock: 20 }, item.id),
            processAuctionStock(auction.id, now),
          ]);
          assert.ok([200, 409].includes(edited.code));
          assert.equal(
            (await Product.findById(item.id)).stock,
            edited.code === 200 ? 14 : 4,
          );
          assert.equal(
            (await Auction.findById(auction.id)).reservaStock,
            "reservada",
          );
        },
      );

      await t.test(
        "Entregas concorrentes só confirmam uma transição",
        async () => {
          const orderTemplate = fixtures.find(
            ([model]) => model === Order,
          )[1][0];
          const data = { ...orderTemplate };
          delete data._id;
          const order = await Order.create({
            ...data,
            estado: "pronta",
            dataEntrega: undefined,
          });
          const responses = await Promise.all([
            invoke(orders, "patch", { estado: "entregue" }, order.id),
            invoke(orders, "patch", { estado: "entregue" }, order.id),
          ]);
          assert.deepEqual(
            responses.map((response) => response.code).sort(),
            [200, 409],
          );
          assert.ok((await Order.findById(order.id)).dataEntrega);
        },
      );
    } finally {
      // Only the uniquely named database created by this test can be dropped.
      if (
        mongoose.connection.name === dbName &&
        dbName.startsWith("codex_stock_test_")
      )
        await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
