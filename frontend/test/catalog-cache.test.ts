import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogQuery, readCatalogCache, writeCatalogCache, readFilterCache, writeFilterCache } from '../src/features/home/catalogCache.ts'
import { emptyFilters } from '../src/features/home/catalogFilters.ts'

test('Chave normalizada inclui pesquisa, filtros e limite e distingue bio=false', () => {
  assert.equal(catalogQuery(' mel ', { ...emptyFilters, bio: 'false' }), catalogQuery('mel', { ...emptyFilters, bio: 'false' }))
  assert.notEqual(catalogQuery('mel', emptyFilters), catalogQuery('mel', { ...emptyFilters, bio: 'false' }))
  assert.match(catalogQuery('', emptyFilters), /limit=24/)
  assert.notEqual(catalogQuery('', emptyFilters, 1), catalogQuery('', emptyFilters, 2))
  assert.equal(new URLSearchParams(catalogQuery('', emptyFilters, 2)).get('page'), '2')
  const extreme = Number(new URLSearchParams(catalogQuery('', emptyFilters, Number.MAX_SAFE_INTEGER)).get('page'))
  assert.ok(Number.isSafeInteger((extreme - 1) * 24))
})

test('Cache mantém dez consultas, promove as reutilizadas e substitui resultados', () => {
  const value = { items: [], total: 1 }
  for (let i = 0; i < 10; i++) writeCatalogCache(`query-${i}`, value)
  assert.equal(readCatalogCache('query-0'), value)
  writeCatalogCache('query-10', value)
  assert.equal(readCatalogCache('query-1'), undefined)
  assert.equal(readCatalogCache('query-0'), value)
  writeCatalogCache('query-0', { items: [], total: 2 })
  assert.equal(readCatalogCache('query-0')?.total, 2)
})

test('Opções de filtros são partilhadas apenas em memória', () => {
  assert.equal(readFilterCache(), null)
  const value = { categorias: ['Mel'], produtores: [], localidades: [] }
  writeFilterCache(value)
  assert.equal(readFilterCache(), value)
})
