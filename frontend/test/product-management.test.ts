import test from "node:test";
import assert from "node:assert/strict";
import {
  productDraft,
  productPayload,
  producerPage,
  type ProducerProduct,
} from "../src/features/products/management.ts";

const product: ProducerProduct = {
  _id: "dca000000000000000000065",
  nome: "Batata",
  descricao: "Batata local",
  categoria: "Hortícolas",
  preco: 150,
  unidade: "kg",
  stock: 12.5,
  epoca: ["verao", "epoca-antiga"],
  biologico: true,
  publicado: true,
  bloqueado: true,
  dataValidade: "2027-01-01T18:30:00.000Z",
  createdAt: "",
  updatedAt: "",
};
test("Criação começa despublicada, aceita publicação e converte euros e frações", () => {
  const draft = {
    ...productDraft(),
    nome: " Batata ",
    descricao: " Local ",
    categoria: " Hortícolas ",
    preco: "1,15",
    stock: "0,5",
  };
  const body = productPayload(draft);
  assert.equal(body.publicado, false);
  assert.equal(body.preco, 115);
  assert.equal(body.stock, 0.5);
  assert.equal(body.nome, "Batata");
  assert.equal(productPayload({ ...draft, publicado: true }).publicado, true);
  assert.equal(productPayload({ ...draft, preco: "0", stock: "0" }).stock, 0);
});
test("Editar apenas preço não envia stock, unidade, bloqueio nem validade", () => {
  const draft = productDraft(product);
  assert.deepEqual(productPayload({ ...draft, preco: "2.30" }, product), {
    preco: 230,
  });
  assert.deepEqual(productPayload(draft, product), {});
  assert.deepEqual(draft.epoca, ["verao", "epoca-antiga"]);
  assert.notEqual(draft.epoca, product.epoca);
});
test("Limpar validade envia null e mudar publicação envia só publicado", () => {
  const draft = productDraft(product);
  assert.deepEqual(productPayload({ ...draft, dataValidade: "" }, product), {
    dataValidade: null,
  });
  assert.deepEqual(productPayload({ ...draft, publicado: false }, product), {
    publicado: false,
  });
});
test("Valida textos vazios, precisão, valores negativos, não finitos e datas", () => {
  const valid = productDraft(product);
  for (const key of ["nome", "descricao", "categoria"] as const)
    assert.throws(() => productPayload({ ...valid, [key]: " " }));
  for (const preco of [
    "",
    "-1",
    "1.001",
    "1e3",
    "Infinity",
    "9007199254740992",
  ])
    assert.throws(() => productPayload({ ...valid, preco }));
  for (const stock of ["", "-1", "NaN", "Infinity", "1e999"])
    assert.throws(() => productPayload({ ...valid, stock }));
  assert.throws(() => productPayload({ ...valid, dataValidade: "2027-02-30" }));
});
test("Paginação rejeita URLs inválidos e offsets fora dos inteiros seguros", () => {
  assert.equal(producerPage("?page=2"), 2);
  for (const query of [
    "",
    "?page=0",
    "?page=-1",
    "?page=x",
    "?page=1.5",
    "?page=9007199254740991",
  ])
    assert.equal(producerPage(query), 1);
});
