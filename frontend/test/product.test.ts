import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogReturnUrl, mapProduct, originMapUrl, productHref, productIdFromPath, productImages } from '../src/features/products/product.ts'

const id = 'dca000000000000000000101'
const product = { _id: id, nome: 'Batata', categoria: 'Hortícolas', preco: 150, unidade: 'kg' }

test('Resolve apenas endereços de produtos com identificadores válidos', () => {
  assert.equal(productIdFromPath(`/produtos/${id}`), id)
  assert.equal(productIdFromPath(`/produtos/${id}/`), id)
  for (const path of ['/', '/produtos/invalido', `/produtos/${id}/extra`]) assert.equal(productIdFromPath(path), null)
})

test('Preserva filtros no regresso e rejeita destinos externos', () => {
  const catalog = '/?q=batata&bio=true&localidade=Viana'
  const url = new URL(productHref(id, catalog), 'https://example.test')
  assert.equal(catalogReturnUrl(url.search), catalog)
  assert.equal(catalogReturnUrl(new URL(productHref(id, '/#produtos'), 'https://example.test').search), '/#produtos')
  for (const value of ['', '?regresso=https://evil.test', '?regresso=//evil.test', '?regresso=/produtos/123']) assert.equal(catalogReturnUrl(value), '/')
})

test('Transforma preço em cêntimos e escolhe apenas imagens locais', () => {
  const mapped = mapProduct(product)
  assert.match(mapped.weight, /^1,50\s€\/kg$/)
  assert.equal(mapped.id, id)
  assert.match(mapped.srcSet!, /Batata-480\.webp 480w, .*Batata-960\.webp 960w/)
  assert.ok(mapped.image?.endsWith('Batata-960.webp'))
  const legacy = { ...product, imagens: ['https://example.test/batata.png'] }
  assert.ok(productImages(legacy).image?.endsWith('Batata-960.webp'))
  assert.ok(productImages({ nome: 'Cenoura' }).image?.endsWith('Cenoura-960.webp'))
  assert.equal(productImages({ ...product, nome: 'Desconhecido' }).image, undefined)
})

test('Mapa só é disponibilizado com coordenadas válidas, incluindo zero', () => {
  assert.equal(originMapUrl(), null)
  assert.equal(originMapUrl({ latitude: 91, longitude: 0 }), null)
  assert.equal(originMapUrl({ latitude: 0, longitude: NaN }), null)
  assert.match(originMapUrl({ latitude: 0, longitude: 0 })!, /google\.com\/maps\/search\//)
  assert.match(originMapUrl({ latitude: 0, longitude: 0 })!, /query=0%2C0/)
})
