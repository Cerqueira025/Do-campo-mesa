import test from "node:test";
import assert from "node:assert/strict";
import {
  readAdminLocation,
  adminDetailHref,
  adminReturnUrl,
} from "../src/features/admin/admin.ts";

test("Leilões abrem ativos, mas preservam a escolha explícita de todos os estados", () => {
  assert.equal(readAdminLocation("leiloes", "").get("estado"), "ativo");
  assert.equal(readAdminLocation("leiloes", "?estado=").get("estado"), "");
  assert.equal(
    readAdminLocation("leiloes", "?estado=terminado").get("estado"),
    "terminado",
  );
});

test("Produtores pendentes impõem papel e aprovação e normalizam paginação insegura", () => {
  const params = readAdminLocation(
    "produtores",
    "?papel=administrador&validacao=aceite&page=-1&q=quinta",
  );
  assert.equal(params.get("papel"), "produtor");
  assert.equal(params.get("validacao"), "pendente");
  assert.equal(params.get("page"), "1");
  assert.equal(params.get("limit"), "24");
  assert.equal(params.get("q"), "quinta");
});

test("Detalhes preservam pesquisa, filtros e página sem aceitar destinos de regresso externos", () => {
  const source = "/admin/produtos?q=mel&visibilidade=bloqueado&page=2";
  const href = adminDetailHref("produtos", "123", source);
  assert.equal(adminReturnUrl("produtos", href.split("?")[1]), source);
  for (const value of [
    "https://example.com",
    "//example.com",
    "/admin/produtos/outro",
    "/admin/utilizadores",
  ]) {
    assert.equal(
      adminReturnUrl("produtos", `regresso=${encodeURIComponent(value)}`),
      "/admin/produtos",
    );
  }
});
