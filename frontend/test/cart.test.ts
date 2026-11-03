import test from "node:test";
import assert from "node:assert/strict";
import {
  cartStorageKey,
  cartTotal,
  groupCart,
  lineTotal,
  readCart,
  validProduct,
  validQuantity,
} from "../src/features/cart/cart.ts";
import type { ProductDetail } from "../src/features/products/product.ts";
import { orderIdFromPath } from "../src/navigation/routePaths.ts";

const product: ProductDetail = {
  _id: "dca000000000000000000065",
  nome: "Batata",
  categoria: "Hortícolas",
  preco: 151,
  unidade: "kg",
  stock: 5,
  descricao: "",
  epoca: [],
  biologico: false,
  produtorId: { _id: "dca000000000000000000004", nome: "Produtor" },
};

test("Recupera carrinho, descarta dados inválidos e consolida linhas sem perder frações", () => {
  let stored = JSON.stringify([
    { produto: product, quantidade: 0.5 },
    { produto: product, quantidade: 0.75 },
    { produto: product, quantidade: -1 },
    { produto: {}, quantidade: 1 },
    null,
  ]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        assert.equal(key, cartStorageKey);
        return stored;
      },
    },
  });
  assert.deepEqual(readCart(), [{ produto: product, quantidade: 1.25 }]);
  for (const value of ["null", "{}", "invalid"]) {
    stored = value;
    assert.deepEqual(readCart(), []);
  }
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Bloqueado");
    },
  });
  assert.deepEqual(readCart(), []);
});

test("Agrupa por produtor e arredonda cada linha a cêntimos antes de somar", () => {
  const second = {
    ...product,
    _id: "dca000000000000000000066",
    produtorId: { _id: "dca000000000000000000005", nome: "Outro" },
  };
  const lines = [
    { produto: product, quantidade: 0.5 },
    { produto: second, quantidade: 0.5 },
  ];
  assert.equal(lineTotal(lines[0]), 76);
  assert.equal(cartTotal(lines), 152);
  assert.equal(groupCart(lines).length, 2);
  assert.deepEqual(groupCart(lines)[1].linhas, [lines[1]]);
});

test("Valida preços, stock, IDs e quantidades sem aceitar dados manipulados no armazenamento", () => {
  assert.equal(validProduct(product), true);
  for (const invalid of [
    { ...product, preco: 1.5 },
    { ...product, stock: -1 },
    { ...product, produtorId: null },
    { ...product, _id: "bad" },
  ])
    assert.equal(validProduct(invalid), false);
  for (const value of [0, -1, Infinity, NaN])
    assert.equal(validQuantity(value), false);
  assert.equal(validQuantity(0.25), true);
  assert.equal(orderIdFromPath("/encomendas/invalid"), null);
  assert.equal(orderIdFromPath(`/encomendas/${product._id}`), product._id);
});
