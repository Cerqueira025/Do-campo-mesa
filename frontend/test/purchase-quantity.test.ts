import test from "node:test";
import assert from "node:assert/strict";
import {
  initialPurchaseQuantity,
  maximumPurchaseQuantity,
  quantityRules,
  quantityToAdd,
  validPurchaseQuantity,
} from "../src/features/products/purchaseQuantity.ts";
import {
  quantityRules as apiRules,
  validPurchaseQuantity as validApiQuantity,
} from "../../api/src/domain/purchaseQuantity.js";

test("Frontend e API aplicam as mesmas regras às quatro unidades", () => {
  assert.deepEqual(quantityRules, apiRules);
  for (const [unit, accepted, rejected] of [
    ["unidade", [1, 2, 30], [0.5, 1.5, 30.343]],
    ["g", [100, 500, 1000], [50, 250, 100.5]],
    ["kg", [0.5, 1, 1.5], [0.25, 0.75, 30.343]],
    ["l", [0.5, 1, 30.5], [0.25, 0.7, 30.343]],
  ] as const) {
    for (const valid of [validPurchaseQuantity, validApiQuantity]) {
      for (const value of accepted) assert.equal(valid(value, unit), true);
      for (const value of [...rejected, 0, -1, NaN, Infinity, -Infinity]) {
        assert.equal(valid(value, unit), false, `${unit}: ${value}`);
      }
      assert.equal(valid(1, "desconhecida"), false);
    }
  }
});

test("Valores iniciais e limites arredondam o stock sem vender restos", () => {
  for (const [unit, stock, initial, maximum] of [
    ["unidade", 5.7, 1, 5],
    ["unidade", 0.7, 0, 0],
    ["g", 1000, 500, 1000],
    ["g", 350, 300, 300],
    ["g", 99, 0, 0],
    ["kg", 5, 1, 5],
    ["kg", 0.7, 0.5, 0.5],
    ["kg", 0.49, 0, 0],
    ["l", 2.7, 1, 2.5],
    ["l", 0.7, 0.5, 0.5],
    ["l", 0, 0, 0],
  ] as const) {
    assert.equal(initialPurchaseQuantity(unit, stock), initial);
    assert.equal(maximumPurchaseQuantity(stock, unit), maximum);
    if (initial)
      assert.equal(validPurchaseQuantity(initial, unit, stock), true);
  }
  assert.equal(maximumPurchaseQuantity(NaN, "g"), 0);
  assert.equal(maximumPurchaseQuantity(-10, "g"), 0);
});

test("Adições rápidas usam a unidade e a quantidade ainda disponível", () => {
  assert.equal(quantityToAdd("unidade", 5, 0), 1);
  assert.equal(quantityToAdd("g", 1350, 0), 500);
  assert.equal(quantityToAdd("g", 1350, 500), 500);
  assert.equal(quantityToAdd("g", 1350, 1000), 300);
  assert.equal(quantityToAdd("kg", 0.7, 0), 0.5);
  assert.equal(quantityToAdd("l", 1.7, 1), 0.5);
  assert.equal(quantityToAdd("kg", 2, 0, 1.5), 1.5);
  assert.throws(() => quantityToAdd("g", 1350, 1300), /suficiente/);
  assert.throws(() => quantityToAdd("g", 1350, 0, 250), /múltiplos/);
  assert.throws(() => quantityToAdd("kg", 5, 0.75), /Corrija/);
  assert.throws(() => quantityToAdd("kg", 1, 0.5, 1), /stock/);
  assert.throws(() => quantityToAdd("unidade", 5, 0, NaN), /múltiplos/);
});
