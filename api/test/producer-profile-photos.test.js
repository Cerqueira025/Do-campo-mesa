import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import Ajv from "ajv-draft-04";
import sharp from "sharp";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";
import { productPhotos } from "../src/services/productPhotos.js";

const owner = "dca000000000000000000004";
const id = "dca000000000000000000065";
const oldPhoto = "11111111-1111-4111-8111-111111111111";
const newPhoto = "22222222-2222-4222-8222-222222222222";
const secret = "producer-profile-photo-tests-only-secret";
const profile = {
  descricao: "Horta",
  localidade: "Viana",
  morada: "Rua da Horta",
  coordenadas: { latitude: 41.7, longitude: -8.8 },
};
const product = {
  _id: id,
  nome: "Batata",
  descricao: "Local",
  categoria: "Hortícolas",
  preco: 150,
  unidade: "kg",
  stock: 10,
  epoca: [],
  biologico: false,
  publicado: false,
  bloqueado: true,
  fotografia: oldPhoto,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const spec = YAML.parse(
  readFileSync(new URL("../../docs/openapi.yaml", import.meta.url), "utf8"),
);
const ajv = new Ajv({ strict: false, validateFormats: false });
const validateProfile = ajv.compile({
  ...spec.components.schemas.ProducerProfileUpdate,
  required: ["descricao", "localidade", "morada", "coordenadas"],
});
const validateProduct = ajv.compile({
  ...spec.components.schemas.ProducerProduct,
  properties: {
    ...spec.components.schemas.ProducerProduct.properties,
    fotografia: spec.components.schemas.ProductPhoto,
  },
});
let server, base;
before(async () => {
  process.env.JWT_SECRET = secret;
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
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
        perfilProdutor:
          papel === "produtor" ? { ...profile, validacao } : undefined,
      }),
  }));
}
async function call(path, method = "GET", body, { token = true, type } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token
        ? {
            Authorization: `Bearer ${jwt.sign({ id: owner }, secret, { expiresIn: "1h" })}`,
          }
        : {}),
      ...(body === undefined
        ? {}
        : { "Content-Type": type || "application/json" }),
    },
    ...(body === undefined ? {} : { body: type ? body : JSON.stringify(body) }),
  });
}
function own(t, value = product) {
  t.mock.method(Product, "findOne", (filter) => {
    assert.deepEqual(filter, { _id: id, produtorId: owner });
    return { select: () => ({ lean: async () => value }) };
  });
}

test("Perfil próprio exige produtor mas admite aprovação pendente, rejeitada e aceite", async (t) => {
  for (const method of ["GET", "PATCH"])
    assert.equal(
      (await call("/producers/me", method, undefined, { token: false })).status,
      401,
    );
  for (const papel of ["comprador", "administrador"]) {
    auth(t, papel);
    assert.equal((await call("/producers/me")).status, 403);
    assert.equal((await call("/producers/me", "PATCH", profile)).status, 403);
    t.mock.restoreAll();
  }
  for (const validacao of ["pendente", "rejeitado", "aceite"]) {
    auth(t, "produtor", validacao);
    t.mock.method(User, "findOne", (filter) => {
      assert.deepEqual(filter, { _id: owner, papel: "produtor" });
      return {
        select: async () => ({
          perfilProdutor: { ...profile, validacao, ultimaDecisao: "Privado" },
        }),
      };
    });
    const response = await call("/producers/me");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.deepEqual(data, profile);
    assert.ok(validateProfile(data), JSON.stringify(validateProfile.errors));
    t.mock.restoreAll();
  }
});

test("PATCH atualiza só os campos enviados, permite descrição vazia e coordenadas zero sem alterar decisões", async (t) => {
  auth(t, "produtor", "rejeitado");
  const body = { descricao: "  ", coordenadas: { latitude: 0, longitude: 0 } };
  t.mock.method(User, "findOneAndUpdate", (filter, update, options) => {
    assert.deepEqual(filter, { _id: owner, papel: "produtor" });
    assert.deepEqual(update, {
      $set: {
        "perfilProdutor.descricao": "",
        "perfilProdutor.coordenadas": body.coordenadas,
      },
    });
    assert.deepEqual(options, { new: true, runValidators: true });
    return {
      select: async () => ({
        perfilProdutor: {
          ...profile,
          ...body,
          descricao: "",
          validacao: "rejeitado",
        },
      }),
    };
  });
  const response = await call("/producers/me", "PATCH", body);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    ...profile,
    ...body,
    descricao: "",
  });
});

test("Perfil rejeita tipos inválidos, campos administrativos e coordenadas incompletas", async (t) => {
  auth(t);
  const write = t.mock.method(User, "findOneAndUpdate", () => {
    throw new Error("Não deve escrever");
  });
  for (const body of [
    {},
    [],
    { validacao: "aceite" },
    { ultimaDecisao: {} },
    { papel: "administrador" },
    { descricao: null },
    { descricao: {} },
    { localidade: " " },
    { morada: 1 },
    { coordenadas: null },
    { coordenadas: [] },
    { coordenadas: { latitude: 0 } },
    { coordenadas: { latitude: "0", longitude: 0 } },
    { coordenadas: { latitude: 91, longitude: 0 } },
    { coordenadas: { latitude: 0, longitude: -181 } },
    { coordenadas: { latitude: 0, longitude: 0, extra: true } },
  ])
    assert.equal(
      (await call("/producers/me", "PATCH", body)).status,
      400,
      JSON.stringify(body),
    );
  assert.equal(write.mock.callCount(), 0);
});

test("Fotografias exigem proprietário aprovado antes de processar o ficheiro", async (t) => {
  const save = t.mock.method(productPhotos, "save", () => {
    throw new Error("Não deve processar");
  });
  for (const method of ["PUT", "DELETE"])
    assert.equal(
      (await call(`/products/${id}/photo`, method, undefined, { token: false }))
        .status,
      401,
    );
  for (const [papel, validacao] of [
    ["comprador"],
    ["administrador"],
    ["produtor", "pendente"],
    ["produtor", "rejeitado"],
  ]) {
    auth(t, papel, validacao);
    for (const method of ["PUT", "DELETE"])
      assert.equal((await call(`/products/${id}/photo`, method)).status, 403);
  }
  auth(t);
  own(t, null);
  assert.equal(
    (
      await call(`/products/${id}/photo`, "PUT", Buffer.from("x"), {
        type: "image/png",
      })
    ).status,
    404,
  );
  assert.equal((await call("/products/invalido/photo", "DELETE")).status, 404);
  assert.equal(save.mock.callCount(), 0);
});

test("Upload substitui a fotografia depois de guardar os ficheiros e devolve DTO privado", async (t) => {
  auth(t);
  own(t);
  const order = [];
  t.mock.method(productPhotos, "save", async (buffer, type) => {
    assert.deepEqual(buffer, Buffer.from("imagem"));
    assert.equal(type, "image/png");
    order.push("save");
    return newPhoto;
  });
  t.mock.method(Product, "findOneAndUpdate", (filter, update) => {
    assert.deepEqual(filter, {
      _id: id,
      produtorId: owner,
      fotografia: oldPhoto,
    });
    assert.deepEqual(update, { $set: { fotografia: newPhoto } });
    order.push("update");
    return {
      select: async () => ({
        ...product,
        fotografia: newPhoto,
        ultimaDecisao: { motivo: "Privado" },
      }),
    };
  });
  t.mock.method(productPhotos, "remove", async (value) => {
    assert.equal(value, oldPhoto);
    order.push("remove");
  });
  const response = await call(
    `/products/${id}/photo`,
    "PUT",
    Buffer.from("imagem"),
    { type: "image/png" },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json();
  assert.equal(data.fotografia, newPhoto);
  assert.ok(validateProduct(data), JSON.stringify(validateProduct.errors));
  assert.deepEqual(order, ["save", "update", "remove"]);
});

test("Upload rejeita tamanho excessivo, formato não suportado, corpo vazio e conteúdo falso", async (t) => {
  auth(t);
  own(t);
  for (const [body, type, expected] of [
    [Buffer.alloc(5 * 1024 * 1024 + 1), "image/png", 413],
    [Buffer.from("GIF89a"), "image/gif", 415],
    [Buffer.alloc(0), "image/png", 400],
    [Buffer.from("não é uma imagem"), "image/png", 400],
  ])
    assert.equal(
      (await call(`/products/${id}/photo`, "PUT", body, { type })).status,
      expected,
    );
});

test("Conflito ou falha na base de dados limpa apenas a nova fotografia", async (t) => {
  auth(t);
  own(t);
  t.mock.method(productPhotos, "save", async () => newPhoto);
  const removed = [];
  t.mock.method(productPhotos, "remove", async (value) => removed.push(value));
  t.mock.method(Product, "findOneAndUpdate", () => ({
    select: async () => null,
  }));
  assert.equal(
    (
      await call(`/products/${id}/photo`, "PUT", Buffer.from("x"), {
        type: "image/png",
      })
    ).status,
    409,
  );
  t.mock.method(Product, "findOneAndUpdate", () => {
    throw new Error("Database unavailable");
  });
  t.mock.method(console, "error", () => {});
  assert.equal(
    (
      await call(`/products/${id}/photo`, "PUT", Buffer.from("x"), {
        type: "image/png",
      })
    ).status,
    500,
  );
  assert.deepEqual(removed, [newPhoto, newPhoto]);
});

test("Falha no disco não altera a referência guardada", async (t) => {
  auth(t);
  own(t);
  t.mock.method(productPhotos, "save", async () => {
    throw Object.assign(new Error("Disco indisponível"), { status: 503 });
  });
  const write = t.mock.method(Product, "findOneAndUpdate", () => {
    throw new Error("Não deve escrever");
  });
  assert.equal(
    (
      await call(`/products/${id}/photo`, "PUT", Buffer.from("x"), {
        type: "image/png",
      })
    ).status,
    503,
  );
  assert.equal(write.mock.callCount(), 0);
});

test("Remover fotografia antiga desativa fallback e limpa ficheiros após atualizar", async (t) => {
  auth(t);
  own(t);
  t.mock.method(Product, "findOneAndUpdate", (filter, update) => {
    assert.equal(filter.fotografia, oldPhoto);
    assert.deepEqual(update, { $set: { fotografia: null } });
    return { select: async () => ({ ...product, fotografia: null }) };
  });
  const remove = t.mock.method(productPhotos, "remove", async () => {});
  const response = await call(`/products/${id}/photo`, "DELETE");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).fotografia, null);
  assert.equal(remove.mock.calls[0].arguments[0], oldPhoto);
});

test("Upload num produto antigo distingue referência ausente de remoção explícita", async (t) => {
  auth(t);
  const legacy = { ...product };
  delete legacy.fotografia;
  own(t, legacy);
  t.mock.method(productPhotos, "save", async () => newPhoto);
  t.mock.method(productPhotos, "remove", async () => {});
  t.mock.method(Product, "findOneAndUpdate", (filter) => {
    assert.deepEqual(filter.fotografia, { $exists: false });
    return { select: async () => ({ ...legacy, fotografia: newPhoto }) };
  });
  assert.equal(
    (
      await call(`/products/${id}/photo`, "PUT", Buffer.from("x"), {
        type: "image/png",
      })
    ).status,
    200,
  );
});

test("Upload real é servido do disco, mantém o MIME e desaparece após remoção", async (t) => {
  auth(t);
  let stored = { ...product };
  delete stored.fotografia;
  t.mock.method(Product, "findOne", () => ({
    select: () => ({ lean: async () => stored }),
  }));
  t.mock.method(Product, "findOneAndUpdate", (_filter, update) => {
    stored = { ...stored, ...update.$set };
    return { select: async () => stored };
  });
  const png = await sharp({
    create: { width: 1000, height: 500, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  const response = await call(`/products/${id}/photo`, "PUT", png, {
    type: "image/png",
  });
  assert.equal(response.status, 200);
  const photo = (await response.json()).fotografia;
  t.after(() => productPhotos.remove(photo));
  const url = `/uploads/products/${photo}-960.webp`;
  const image = await call(url, "GET", undefined, { token: false });
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /image\/webp/);
  assert.match(image.headers.get("cache-control"), /immutable/);
  assert.equal(image.headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    (await sharp(Buffer.from(await image.arrayBuffer())).metadata()).width,
    960,
  );
  assert.equal((await call(`/products/${id}/photo`, "DELETE")).status, 200);
  assert.equal((await call(url)).status, 404);
});
