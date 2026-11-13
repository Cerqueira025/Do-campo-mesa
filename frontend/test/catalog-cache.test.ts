import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogQuery,
  invalidateCatalogCache,
  catalogPagination,
  readCatalogCache,
  writeCatalogCache,
  readFilterCache,
  writeFilterCache,
  readCatalogProduct,
} from "../src/features/home/catalogCache.ts";
import { emptyFilters } from "../src/features/home/catalogFilters.ts";
import type { ProductDetail } from "../src/features/products/product.ts";

test("Paginação cobre intervalos, catálogo vazio e páginas acima do total atual", () => {
  assert.deepEqual(catalogPagination(1, 33), {
    page: 1,
    pages: 2,
    first: 1,
    last: 24,
  });
  assert.deepEqual(catalogPagination(2, 33), {
    page: 2,
    pages: 2,
    first: 25,
    last: 33,
  });
  assert.deepEqual(catalogPagination(99, 33), catalogPagination(2, 33));
  assert.deepEqual(catalogPagination(2, 24), {
    page: 1,
    pages: 1,
    first: 1,
    last: 24,
  });
  assert.deepEqual(catalogPagination(Number.MAX_SAFE_INTEGER, 0), {
    page: 1,
    pages: 1,
    first: 0,
    last: 0,
  });
});

test("Chave normalizada inclui pesquisa, filtros e limite e distingue bio=false", () => {
  assert.equal(
    catalogQuery(" mel ", { ...emptyFilters, bio: "false" }),
    catalogQuery("mel", { ...emptyFilters, bio: "false" }),
  );
  assert.notEqual(
    catalogQuery("mel", emptyFilters),
    catalogQuery("mel", { ...emptyFilters, bio: "false" }),
  );
  assert.match(catalogQuery("", emptyFilters), /limit=24/);
  assert.notEqual(
    catalogQuery("", emptyFilters, 1),
    catalogQuery("", emptyFilters, 2),
  );
  assert.equal(
    new URLSearchParams(catalogQuery("", emptyFilters, 2)).get("page"),
    "2",
  );
  const extreme = Number(
    new URLSearchParams(
      catalogQuery("", emptyFilters, Number.MAX_SAFE_INTEGER),
    ).get("page"),
  );
  assert.ok(Number.isSafeInteger((extreme - 1) * 24));
});

test("Cache mantém dez consultas, promove as reutilizadas e substitui resultados", () => {
  const value = { items: [], total: 1 };
  for (let i = 0; i < 10; i++) writeCatalogCache(`query-${i}`, value);
  assert.equal(readCatalogCache("query-0"), value);
  writeCatalogCache("query-10", value);
  assert.equal(readCatalogCache("query-1"), undefined);
  assert.equal(readCatalogCache("query-0"), value);
  writeCatalogCache("query-0", { items: [], total: 2 });
  assert.equal(readCatalogCache("query-0")?.total, 2);
});

test("Opções de filtros são partilhadas apenas em memória", () => {
  assert.equal(readFilterCache(), null);
  const value = { categorias: ["Mel"], produtores: [], localidades: [] };
  writeFilterCache(value);
  assert.equal(readFilterCache(), value);
});

test("Detalhe reutiliza o produto completo da consulta mais recente", () => {
  const product: ProductDetail = {
    _id: "dca000000000000000000101",
    nome: "Batata",
    descricao: "Batata local",
    categoria: "Hortícolas",
    preco: 150,
    unidade: "kg",
    stock: 10,
    epoca: ["todo-o-ano"],
    biologico: true,
    produtorId: { _id: "dca000000000000000000001", nome: "Produtor" },
  };
  assert.equal(readCatalogProduct(product._id), undefined);
  writeCatalogCache("product-original", { items: [product], total: 1 });
  assert.equal(readCatalogProduct(product._id.toUpperCase()), product);

  const updated = { ...product, stock: 5 };
  writeCatalogCache("product-updated", { items: [updated], total: 1 });
  assert.equal(readCatalogProduct(product._id), updated);
  assert.equal(readCatalogProduct("dca000000000000000000999"), undefined);

  for (let i = 0; i < 10; i++)
    writeCatalogCache(`product-eviction-${i}`, { items: [], total: 0 });
  assert.equal(readCatalogProduct(product._id), undefined);
});

test("Alterações de produtos invalidam resultados e opções de filtros", () => {
  writeCatalogCache("antes-da-edicao", { items: [], total: 1 });
  writeFilterCache({ categorias: ["Antiga"], produtores: [], localidades: [] });
  invalidateCatalogCache();
  assert.equal(readCatalogCache("antes-da-edicao"), undefined);
  assert.equal(readFilterCache(), null);
});
