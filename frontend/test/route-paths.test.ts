import test from "node:test";
import assert from "node:assert/strict";
import {
  auctionIdFromPath,
  orderIdFromPath,
  productIdFromPath,
} from "../src/navigation/routePaths.ts";

test("Detalhes aceitam IDs válidos e barra final sem confundir famílias de rotas", () => {
  const id = "DCA000000000000000000101";
  for (const [prefix, parse] of [
    ["produtos", productIdFromPath],
    ["leiloes", auctionIdFromPath],
    ["encomendas", orderIdFromPath],
  ] as const) {
    assert.equal(parse(`/${prefix}/${id}`), id);
    assert.equal(parse(`/${prefix}/${id}/`), id);
    for (const path of [
      "/",
      "/desconhecido",
      "/login",
      "/admin",
      `/${prefix}`,
      `/${prefix}/`,
      `/${prefix}/invalido`,
      `/${prefix}/${id}0`,
      `/${prefix}/${id}/extra`,
      `/outra-rota/${id}`,
    ]) {
      assert.equal(parse(path), null, path);
    }
  }
});
