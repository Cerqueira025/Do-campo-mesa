import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import Ajv from "ajv-draft-04";
import app from "../src/app.js";
import Product from "../src/models/Product.js";
import User from "../src/models/User.js";
import Auction from "../src/models/Auction.js";
import { productPhotos } from "../src/services/productPhotos.js";

const owner = "dca000000000000000000004";
const id = "dca000000000000000000065";
const secret = "product-management-tests-only-secret";
const specification = YAML.parse(
  readFileSync(new URL("../../docs/openapi.yaml", import.meta.url), "utf8"),
);
const validate = new Ajv({ strict: false, validateFormats: false }).compile({
  ...specification.components.schemas.ProducerProduct,
  components: specification.components,
});
const sample = {
  _id: id,
  nome: "Batata",
  descricao: "Local",
  categoria: "Hortícolas",
  preco: 150,
  unidade: "kg",
  stock: 10.5,
  epoca: ["verao"],
  biologico: false,
  fotografia: "11111111-1111-4111-8111-111111111111",
  publicado: false,
  bloqueado: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
let server, base;
before(async () => {
  process.env.JWT_SECRET = secret;
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/products`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
function auth(t, papel = "produtor", validacao = "aceite") {
  t.mock.method(User, "findById", () => ({
    select: async () =>
      new User({
        _id: owner,
        papel,
        nome: "Produtor",
        email: "a@example.test",
        perfilProdutor: papel === "produtor" ? { validacao } : undefined,
      }),
  }));
}
async function call(path = "", method = "GET", body, token = true) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token
        ? {
            Authorization: `Bearer ${jwt.sign({ id: owner }, secret, { expiresIn: "1h" })}`,
          }
        : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test("Consultas privadas exigem sessão, papel de produtor e aprovação atual", async (t) => {
  for (const path of ["/mine", `/mine/${id}`])
    assert.equal((await call(path, "GET", undefined, false)).status, 401);
  for (const [papel, approval] of [
    ["comprador"],
    ["administrador"],
    ["produtor", "pendente"],
    ["produtor", "rejeitado"],
  ]) {
    auth(t, papel, approval);
    for (const path of ["/mine", `/mine/${id}`])
      assert.equal((await call(path)).status, 403);
    t.mock.restoreAll();
  }
});
test("Lista produtos próprios ocultos, pagina e não expõe dados administrativos", async (t) => {
  auth(t);
  t.mock.method(Product, "find", (filter) => {
    assert.deepEqual(filter, { produtorId: owner });
    const chain = {
      select(value) {
        assert.match(value, /bloqueado/);
        assert.doesNotMatch(value, /ultimaDecisao|revisaoLeiloes|imagens/);
        return chain;
      },
      sort(value) {
        assert.deepEqual(value, { createdAt: -1, _id: 1 });
        return chain;
      },
      skip(value) {
        assert.equal(value, 24);
        return chain;
      },
      limit(value) {
        assert.equal(value, 24);
        return chain;
      },
      lean: async () => [
        {
          ...sample,
          ultimaDecisao: { motivo: "Privado" },
          revisaoLeiloes: 9,
          __v: 2,
          produtorId: owner,
          imagens: [],
        },
      ],
    };
    return chain;
  });
  t.mock.method(Product, "countDocuments", async (filter) => {
    assert.deepEqual(filter, { produtorId: owner });
    return 25;
  });
  const response = await call("/mine?page=2");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json();
  assert.deepEqual(data, { items: [sample], page: 2, limit: 24, total: 25 });
  assert.ok(validate(data.items[0]), JSON.stringify(validate.errors));
});
test("Rejeita paginação inválida sem consultar produtos", async (t) => {
  auth(t);
  t.mock.method(Product, "find", () => {
    throw new Error("Não consultar.");
  });
  for (const query of [
    "page=0",
    "page=-1",
    "limit=101",
    "limit=0",
    "page=1&page=2",
    "limit=NaN",
    "page=9007199254740991",
  ])
    assert.equal((await call(`/mine?${query}`)).status, 400);
});
test("Detalhe privado filtra pelo proprietário e mantém produto despublicado/bloqueado", async (t) => {
  auth(t);
  t.mock.method(Product, "findOne", (filter) => {
    assert.deepEqual(filter, { _id: id, produtorId: owner });
    return {
      select: () => ({
        lean: async () => ({ ...sample, ultimaDecisao: "segredo" }),
      }),
    };
  });
  const response = await call(`/mine/${id}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), sample);
});
test("Detalhe privado devolve 404 para ID inválido ou produto de outro produtor", async (t) => {
  auth(t);
  const query = t.mock.method(Product, "findOne", (filter) => {
    assert.equal(filter.produtorId, owner);
    return { select: () => ({ lean: async () => null }) };
  });
  assert.equal((await call("/mine/invalido")).status, 404);
  assert.equal(query.mock.callCount(), 0);
  assert.equal((await call(`/mine/${id}`)).status, 404);
});
function mutations(t, active = false) {
  auth(t);
  const session = {
    async withTransaction(fn) {
      await fn();
    },
    async endSession() {},
  };
  t.mock.method(mongoose, "startSession", async () => session);
  const product = Product.hydrate({ ...sample, produtorId: owner });
  t.mock.method(Product, "findOne", (filter) => {
    assert.equal(filter.produtorId, owner);
    const query = {
      select() {
        return this;
      },
      session: async (value) => {
        assert.equal(value, session);
        return product;
      },
      then: (resolve) => resolve(product),
    };
    return query;
  });
  t.mock.method(product, "populate", async () => product);
  const save = t.mock.method(product, "save", async (options) => {
    if (product.isModified("stock") || product.isModified("unidade"))
      assert.equal(options.session, session);
    return product;
  });
  t.mock.method(Auction, "exists", (filter) => ({
    session: async () => {
      assert.equal(String(filter["produtos.produtoId"]), id);
      return active ? { _id: "auction" } : null;
    },
  }));
  return { product, save, session };
}
test("Atualizar preço/publicação não altera stock nem remove bloqueio", async (t) => {
  const { product } = mutations(t, true);
  const response = await call(`/${id}`, "PUT", {
    preco: 230,
    publicado: true,
    bloqueado: false,
    fotografia: "22222222-2222-4222-8222-222222222222",
    produtorId: "outro",
  });
  assert.equal(response.status, 200);
  assert.equal(product.preco, 230);
  assert.equal(product.stock, 10.5);
  assert.equal(product.bloqueado, true);
  assert.equal(product.fotografia, sample.fotografia);
  assert.equal(String(product.produtorId), owner);
});
test("Reserva de leilão impede guardar stock/unidade", async (t) => {
  const { save } = mutations(t, true);
  for (const body of [{ stock: 20 }, { unidade: "g" }]) {
    const response = await call(`/${id}`, "PUT", body);
    assert.equal(response.status, 409);
    assert.match((await response.json()).erro, /quantidades reservadas/);
  }
  assert.equal(save.mock.callCount(), 0);
});
test("Stock zero e fracionado são guardados na transação quando não há leilão ativo", async (t) => {
  const { product, save } = mutations(t);
  for (const stock of [0, 2.5]) {
    assert.equal((await call(`/${id}`, "PUT", { stock })).status, 200);
    assert.equal(product.stock, stock);
  }
  assert.equal(save.mock.callCount(), 2);
});
test("Eliminar recusa qualquer leilão associado e liberta a sessão", async (t) => {
  const { product, session } = mutations(t, true);
  t.mock.method(
    Product,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.equal(filter.produtorId, owner);
      assert.equal(update.$inc.revisaoLeiloes, 1);
      assert.equal(options.session, session);
      return product;
    },
  );
  const deletion = t.mock.method(Product, "findOneAndDelete", () => {
    throw new Error("Não eliminar.");
  });
  const end = t.mock.method(session, "endSession", async () => {});
  const cleanup = t.mock.method(productPhotos, "remove", async () => {});
  const response = await call(`/${id}`, "DELETE");
  assert.equal(response.status, 409);
  assert.equal(deletion.mock.callCount(), 0);
  assert.equal(end.mock.callCount(), 1);
  assert.equal(cleanup.mock.callCount(), 0);
});
test("Eliminar produto sem leilões devolve 204", async (t) => {
  const { product, session } = mutations(t);
  product.fotografia = "11111111-1111-4111-8111-111111111111";
  let committed = false;
  t.mock.method(session, "withTransaction", async (operation) => {
    await operation();
    committed = true;
  });
  const cleanup = t.mock.method(productPhotos, "remove", async (value) => {
    assert.equal(committed, true);
    assert.equal(value, product.fotografia);
  });
  t.mock.method(Product, "findOneAndUpdate", async () => product);
  const deletion = t.mock.method(
    Product,
    "findOneAndDelete",
    async (filter, options) => {
      assert.equal(filter.produtorId, owner);
      assert.equal(options.session, session);
      return product;
    },
  );
  assert.equal((await call(`/${id}`, "DELETE")).status, 204);
  assert.equal(deletion.mock.callCount(), 1);
  assert.equal(cleanup.mock.callCount(), 1);
});
test("Criação respeita publicado explícito e ignora bloqueio e proprietário enviados", async (t) => {
  auth(t);
  t.mock.method(Product, "create", async (body) => {
    assert.equal(body.produtorId, owner);
    assert.equal(body.bloqueado, undefined);
    assert.equal(body.fotografia, undefined);
    const document = new Product(body);
    await document.validate();
    document.populate = async () => document;
    return document;
  });
  for (const publicado of [false, true]) {
    const response = await call("", "POST", {
      ...sample,
      publicado,
      produtorId: "outro",
      bloqueado: true,
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).publicado, publicado);
  }
});

test("Despublicar/bloquear oculta leilões da lista e do detalhe públicos", async (t) => {
  const visible = {
    _id: id,
    estado: "agendado",
    dataInicio: "2030-01-01T12:00:00Z",
    dataFim: "2030-01-02T12:00:00Z",
    produtorId: { _id: owner, nome: "Produtor" },
    produtos: [
      {
        produtoId: { nome: "Visível", produtorId: owner },
        quantidade: 1,
        unidade: "kg",
      },
    ],
  };
  const populated = (result) => ({
    sort() {
      return this;
    },
    populate(options) {
      if (options.path === "produtos.produtoId")
        assert.deepEqual(options.match, {
          publicado: true,
          bloqueado: { $ne: true },
        });
      return this;
    },
    lean: async () => result,
  });
  t.mock.method(Auction, "find", () =>
    populated([visible, { ...visible, produtos: [{ produtoId: null }] }]),
  );
  t.mock.method(Auction, "findById", () =>
    populated({ ...visible, produtos: [{ produtoId: null }] }),
  );
  const auctionBase = base.replace("/products", "/auctions");
  const list = await fetch(auctionBase);
  assert.equal(list.status, 200);
  const items = await list.json();
  assert.equal(items.length, 1);
  assert.equal(items[0]._id, id);
  assert.equal(items[0].produtos[0].produtoId.nome, "Visível");
  assert.equal((await fetch(`${auctionBase}/${id}`)).status, 404);
});

test("Criar leilão escreve no produto e guarda o lote na mesma transação", async (t) => {
  auth(t);
  const session = {
    async withTransaction(fn) {
      await fn();
    },
    async endSession() {},
  };
  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(
    Product,
    "findOneAndUpdate",
    async (filter, update, options) => {
      assert.equal(filter.produtorId, owner);
      assert.equal(filter.publicado, true);
      assert.deepEqual(filter.bloqueado, { $ne: true });
      assert.equal(update.$inc.revisaoLeiloes, 1);
      assert.equal(options.session, session);
      return new Product({ ...sample, produtorId: owner });
    },
  );
  t.mock.method(Auction, "create", async ([body], options) => {
    assert.equal(options.session, session);
    const document = new Auction(body);
    await document.validate();
    document.populate = async () => document;
    return [document];
  });
  const response = await fetch(base.replace("/products", "/auctions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt.sign({ id: owner }, secret, { expiresIn: "1h" })}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      produtos: [{ produtoId: id, quantidade: 1 }],
      lote: "Batata",
      precoBase: 100,
      incremento: 10,
      dataInicio: "2030-01-01T12:00:00Z",
      dataFim: "2030-01-02T12:00:00Z",
    }),
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).produtos[0].unidade, "kg");
});
