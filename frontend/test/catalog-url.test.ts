import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyFilters, readCatalogUrl, writeCatalogUrl } from '../src/features/home/catalogFilters.ts'

function browserAt(href: string) {
  const calls: string[] = []
  const location = new URL(href)
  const history = {
    state: { campoMesa: { key: 'catalog', index: 0, url: location.pathname + location.search } } as Record<string, unknown>,
    replaceState: (state: Record<string, unknown>, _title: string, url: URL | string) => {
      calls.push('replace')
      history.state = state
      location.href = new URL(url, location).href
    },
    pushState: (state: Record<string, unknown>, _title: string, url: URL | string) => {
      calls.push('push')
      history.state = state
      location.href = new URL(url, location).href
    },
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, history, scrollX: 0, scrollY: 0, dispatchEvent: () => {} } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { activeElement: null } })
  return { calls, location }
}

test('Restaura todos os filtros e valida época, booleano e identificador', () => {
  browserAt('http://localhost/?q=ma%C3%A7%C3%A3&categoria=Fruta&epoca=outono&bio=false&produtorId=dca000000000000000000004&localidade=Viana&avaliacaoMin=4.5')
  assert.deepEqual(readCatalogUrl(), {
    page: 1,
    search: 'maçã',
    filters: { categoria: 'Fruta', epoca: 'outono', bio: 'false', produtorId: 'dca000000000000000000004', localidade: 'Viana', avaliacaoMin: '4.5' },
  })
  browserAt('http://localhost/?epoca=desconhecida&bio=sim&produtorId=invalido&avaliacaoMin=6')
  assert.deepEqual(readCatalogUrl().filters, emptyFilters)
})

test('Página aceita inteiros positivos seguros e ignora formatos inválidos', () => {
  for (const value of ['', '0', '-1', '1.5', '1e2', 'Infinity', '9007199254740992', 'texto']) {
    browserAt(`http://localhost/?page=${value}`)
    assert.equal(readCatalogUrl().page, 1, value)
  }
  browserAt('http://localhost/?page=2')
  assert.equal(readCatalogUrl().page, 2)
  browserAt(`http://localhost/?page=${Number.MAX_SAFE_INTEGER}`)
  assert.equal(readCatalogUrl().page, Number.MAX_SAFE_INTEGER)
})

test('Mudar de página preserva filtros e histórico; alterar filtros regressa à primeira', () => {
  const { location, calls } = browserAt('http://localhost/?q=mel&bio=false')
  writeCatalogUrl('mel', { ...emptyFilters, bio: 'false' }, false, 2)
  assert.equal(location.searchParams.get('page'), '2')
  assert.equal(location.searchParams.get('q'), 'mel')
  assert.equal(location.searchParams.get('bio'), 'false')
  writeCatalogUrl('mel', { ...emptyFilters, epoca: 'outono' }, false)
  assert.equal(location.searchParams.has('page'), false)
  assert.deepEqual(calls, ['push', 'push'])
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
