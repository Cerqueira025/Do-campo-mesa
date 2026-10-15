import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyFilters, readCatalogUrl, writeCatalogUrl } from '../src/features/home/catalogFilters.ts'

function browserAt(href: string) {
  const calls: string[] = []
  const location = new URL(href)
  const history = {
    replaceState: (_state: unknown, _title: string, url: URL) => {
      calls.push('replace')
      location.href = url.href
    },
    pushState: (_state: unknown, _title: string, url: URL) => {
      calls.push('push')
      location.href = url.href
    },
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, history } })
  return { calls, location }
}

test('Restaura todos os filtros e valida época, booleano e identificador', () => {
  browserAt('http://localhost/?q=ma%C3%A7%C3%A3&categoria=Fruta&epoca=outono&bio=false&produtorId=dca000000000000000000004&localidade=Viana&avaliacaoMin=4.5')
  assert.deepEqual(readCatalogUrl(), {
    search: 'maçã',
    filters: { categoria: 'Fruta', epoca: 'outono', bio: 'false', produtorId: 'dca000000000000000000004', localidade: 'Viana', avaliacaoMin: '4.5' },
  })
  browserAt('http://localhost/?epoca=desconhecida&bio=sim&produtorId=invalido&avaliacaoMin=6')
  assert.deepEqual(readCatalogUrl().filters, emptyFilters)
})

test('Pesquisa substitui histórico; filtros criam entrada; limpar preserva pesquisa e parâmetros alheios', () => {
  const { calls, location } = browserAt('http://localhost/?origem=teste#produtos')
  writeCatalogUrl(' mel ', emptyFilters, true)
  writeCatalogUrl('mel', { ...emptyFilters, bio: 'false', epoca: 'outono' }, false)
  assert.equal(location.searchParams.get('bio'), 'false')
  writeCatalogUrl('mel', emptyFilters, false)
  assert.deepEqual(calls, ['replace', 'push', 'push'])
  assert.equal(location.searchParams.get('q'), 'mel')
  assert.equal(location.searchParams.get('origem'), 'teste')
  assert.equal(location.searchParams.has('bio'), false)
  assert.equal(location.hash, '#produtos')
  writeCatalogUrl('mel', emptyFilters, false)
  assert.equal(calls.length, 3)
})
