import test from "node:test";
import assert from "node:assert/strict";
import {
  ratingText,
  notifyReviewChange,
} from "../src/features/reviews/review.ts";
import {
  writeCatalogCache,
  readCatalogCache,
  readCatalogProduct,
} from "../src/features/home/catalogCache.ts";
import {
  mapProduct,
  type ProductDetail,
} from "../src/features/products/product.ts";
import { producerIdFromPath } from "../src/navigation/routePaths.ts";

test("Classificações usam formato português, singular e estado vazio sem zero fictício", () => {
  assert.equal(ratingText(), "Sem avaliações");
  assert.equal(ratingText({ media: null, total: 0 }), "Sem avaliações");
  assert.equal(ratingText({ media: 5, total: 1 }), "5 de 5 · 1 avaliação");
  assert.equal(
    ratingText({ media: 4.67, total: 3 }),
    "4,67 de 5 · 3 avaliações",
  );
});

test("Alterações nas avaliações invalidam todas as consultas do catálogo e avisam as páginas", (t) => {
  const events = new EventTarget();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: events,
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  });
  let changes = 0;
  events.addEventListener("reviews-changed", () => {
    changes++;
  });
  const product: ProductDetail = {
    _id: "dca000000000000000000065",
    nome: "Batata",
    categoria: "Hortícolas",
    preco: 150,
    unidade: "kg",
    stock: 1,
    descricao: "Local",
    epoca: [],
    biologico: false,
    produtorId: { _id: "dca000000000000000000004", nome: "Quinta" },
    avaliacao: { media: 4.67, total: 3 },
  };
  writeCatalogCache("all", { items: [product], total: 1 });
  writeCatalogCache("rated", { items: [product], total: 1 });
  assert.deepEqual(mapProduct(product).avaliacao, { media: 4.67, total: 3 });
  notifyReviewChange();
  assert.equal(changes, 1);
  assert.equal(readCatalogCache("all"), undefined);
  assert.equal(readCatalogCache("rated"), undefined);
  assert.equal(readCatalogProduct(product._id), undefined);
});

test("Perfil público aceita apenas a família de rotas e identificadores previstos", () => {
  const id = "dca000000000000000000004";
  assert.equal(producerIdFromPath(`/produtores/${id}`), id);
  assert.equal(producerIdFromPath(`/produtores/${id}/`), id);
  for (const path of [
    "/produtor/encomendas",
    "/produtores/invalido",
    `/produtores/${id}/extra`,
    `/produtos/${id}`,
  ])
    assert.equal(producerIdFromPath(path), null);
});
