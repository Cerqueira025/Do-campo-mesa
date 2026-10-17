import test from 'node:test'
import assert from 'node:assert/strict'
import { auctionHref, auctionIdFromPath, auctionState, bidInputValue, featuredAuction, formatRemaining, isAuction, parseBid, remainingSeconds, type Auction } from '../src/features/auctions/auction.ts'
import { catalogReturnUrl } from '../src/features/products/product.ts'

const id = 'dca000000000000000004001'
const now = Date.parse('2026-10-15T12:00:00Z')
const auction: Auction = {
  _id: id, produtoId: { nome: 'Azeite', imagens: [] }, lote: '12 garrafas',
  incremento: 500, licitacaoAtual: { valor: 8400 }, estado: 'ativo',
  dataInicio: '2026-10-15T11:00:00Z', dataFim: '2026-10-15T13:00:00Z',
}

test('Resolve rotas de leilões e preserva o regresso com pesquisa e filtros', () => {
  assert.equal(auctionIdFromPath(`/leiloes/${id}`), id)
  assert.equal(auctionIdFromPath(`/leiloes/${id}/`), id)
  for (const path of ['/leiloes', '/leiloes/invalido', `/leiloes/${id}/extra`, `/produtos/${id}`]) {
    assert.equal(auctionIdFromPath(path), null)
  }
  const catalog = '/?q=azeite&bio=true'
  const href = new URL(auctionHref(id, catalog), 'https://example.test')
  assert.equal(catalogReturnUrl(href.search), catalog)
  assert.equal(auctionHref(id), `/leiloes/${id}`)
  assert.equal(catalogReturnUrl('?regresso=//evil.test'), '/')
})

test('Converte montantes em cêntimos sem aceitar formatos ambíguos ou precisão excessiva', () => {
  for (const [input, expected] of [['89,00', 8900], ['89.5', 8950], ['89', 8900], ['0,01', 1], [' 94,25 ', 9425]] as const) {
    assert.equal(parseBid(input), expected)
    assert.equal(parseBid(bidInputValue(expected)), expected)
  }
  for (const input of ['', '0', '-5', '1,234', '1e3', '1.000,50', 'Infinity', '9 0', '9007199254740992']) {
    assert.equal(parseBid(input), null)
  }
  assert.equal(bidInputValue(auction.licitacaoAtual.valor + auction.incremento), '89,00')
})

test('Aplica datas nos limites de início e fim e respeita o término explícito', () => {
  assert.equal(auctionState(auction, Date.parse(auction.dataInicio) - 1), 'agendado')
  assert.equal(auctionState(auction, Date.parse(auction.dataInicio)), 'ativo')
  assert.equal(auctionState(auction, Date.parse(auction.dataFim) - 1), 'ativo')
  assert.equal(auctionState(auction, Date.parse(auction.dataFim)), 'terminado')
  assert.equal(auctionState({ ...auction, estado: 'terminado' }, now), 'terminado')
  assert.equal(remainingSeconds(now + 1, now), 1)
  assert.equal(remainingSeconds(now - 1, now), 0)
  assert.equal(formatRemaining(1122), '18:42')
  assert.equal(formatRemaining(3601), '01:00:01')
  assert.equal(formatRemaining(0), '00:00')
})

test('Seleciona o leilão em curso com fim mais próximo, sem alterar a lista recebida', () => {
  const sooner = { ...auction, _id: 'dca000000000000000004002', dataFim: '2026-10-15T12:30:00Z' }
  const list = [auction, { ...auction, estado: 'terminado' as const }, sooner,
    { ...auction, dataInicio: '2026-10-15T12:20:00Z' }, { ...auction, dataFim: '2026-10-15T11:30:00Z' }]
  assert.equal(featuredAuction(list, now), sooner)
  assert.equal(list[0], auction)
  assert.equal(featuredAuction([], now), null)
  assert.equal(featuredAuction([auction], Date.parse(auction.dataFim)), null)
})

test('Rejeita respostas sem produto, datas válidas ou montantes inteiros seguros', () => {
  assert.equal(isAuction(auction), true)
  for (const value of [null, {}, { ...auction, produtoId: null }, { ...auction, incremento: 0 },
    { ...auction, dataFim: 'inválida' }, { ...auction, dataFim: auction.dataInicio },
    { ...auction, estado: 'desconhecido' }, { ...auction, licitacaoAtual: { valor: 84.5 } },
    { ...auction, licitacaoAtual: { valor: Number.MAX_SAFE_INTEGER } },
    { ...auction, produtoId: { nome: 'Azeite', imagens: [123] } }]) assert.equal(isAuction(value), false)
})
