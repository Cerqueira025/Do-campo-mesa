import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogReturnUrl,
  mapProduct,
  originMapUrl,
  productHref,
  productImages,
} from "../src/features/products/product.ts";
import { productIdFromPath } from "../src/navigation/routePaths.ts";

const id = "dca000000000000000000101";
const product = {
  _id: id,
  nome: "Batata",
  categoria: "Hortícolas",
  preco: 150,
  unidade: "kg",
};

test("Resolve apenas endereços de produtos com identificadores válidos", () => {
  assert.equal(productIdFromPath(`/produtos/${id}`), id);
  assert.equal(productIdFromPath(`/produtos/${id}/`), id);
  for (const path of ["/", "/produtos/invalido", `/produtos/${id}/extra`])
    assert.equal(productIdFromPath(path), null);
});

test("Preserva filtros no regresso e rejeita destinos externos", () => {
  const catalog = "/?q=batata&bio=true&localidade=Viana";
  const url = new URL(productHref(id, catalog), "https://example.test");
  assert.equal(catalogReturnUrl(url.search), catalog);
  assert.equal(
    catalogReturnUrl(
      new URL(productHref(id, "/#produtos"), "https://example.test").search,
    ),
    "/#produtos",
  );
  for (const value of [
    "",
    "?regresso=https://evil.test",
    "?regresso=//evil.test",
    "?regresso=/produtos/123",
  ])
    assert.equal(catalogReturnUrl(value), "/");
});

test("Transforma preço em cêntimos e escolhe apenas imagens locais", () => {
  const mapped = mapProduct(product);
  assert.match(mapped.weight, /^1,50\s€\/kg$/);
  assert.equal(mapped.id, id);
  assert.match(
    mapped.srcSet!,
    /Batata-480\.webp 480w, .*Batata-960\.webp 960w/,
  );
  assert.ok(mapped.image?.endsWith("Batata-960.webp"));
  const legacy = { ...product, imagens: ["https://example.test/batata.png"] };
  assert.ok(productImages(legacy).image?.endsWith("Batata-960.webp"));
  assert.ok(
    productImages({ nome: "Cenoura" }).image?.endsWith("Cenoura-960.webp"),
  );
  assert.equal(
    productImages({ ...product, nome: "Desconhecido" }).image,
    undefined,
  );
});

test("Mapa só é disponibilizado com coordenadas válidas, incluindo zero", () => {
  assert.equal(originMapUrl(), null);
  assert.equal(originMapUrl({ latitude: 91, longitude: 0 }), null);
  assert.equal(originMapUrl({ latitude: 0, longitude: NaN }), null);
  assert.match(
    originMapUrl({ latitude: 0, longitude: 0 })!,
    /google\.com\/maps\/search\//,
  );
  assert.match(originMapUrl({ latitude: 0, longitude: 0 })!, /query=0%2C0/);
});

test("Fotografia carregada é independente do nome e null remove a imagem antiga", () => {
  const fotografia = "11111111-1111-4111-8111-111111111111";
  const first = productImages({ nome: "Batata", fotografia });
  assert.equal(first.image, `/api/uploads/products/${fotografia}-960.webp`);
  assert.equal(
    first.srcSet,
    `/api/uploads/products/${fotografia}-480.webp 480w, /api/uploads/products/${fotografia}-960.webp 960w`,
  );
  assert.deepEqual(productImages({ nome: "Outro nome", fotografia }), first);
  assert.equal(mapProduct({ ...product, fotografia }).image, first.image);
  assert.equal(
    productImages({ nome: "Batata", fotografia: null }).image,
    undefined,
  );
  assert.ok(
    productImages({ nome: "Batata" }).image?.endsWith("Batata-960.webp"),
  );
});
