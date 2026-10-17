export interface Auction {
  _id: string
  produtoId: { nome: string; imagens: string[] }
  lote: string
  incremento: number
  dataInicio: string
  dataFim: string
  estado: 'agendado' | 'ativo' | 'terminado'
  licitacaoAtual: { valor: number }
}

export function isAuction(value: unknown): value is Auction {
  if (!value || typeof value !== 'object') return false
  const auction = value as Auction
  return typeof auction._id === 'string' && /^[a-f\d]{24}$/i.test(auction._id) &&
    !!auction.produtoId && typeof auction.produtoId.nome === 'string' &&
    Array.isArray(auction.produtoId.imagens) && auction.produtoId.imagens.every((image) => typeof image === 'string') &&
    typeof auction.lote === 'string' && Number.isSafeInteger(auction.incremento) && auction.incremento > 0 &&
    Number.isSafeInteger(auction.licitacaoAtual?.valor) && auction.licitacaoAtual.valor >= 0 &&
    Number.isSafeInteger(auction.licitacaoAtual.valor + auction.incremento) &&
    ['agendado', 'ativo', 'terminado'].includes(auction.estado) &&
    Number.isFinite(Date.parse(auction.dataInicio)) && Number.isFinite(Date.parse(auction.dataFim)) &&
    Date.parse(auction.dataInicio) < Date.parse(auction.dataFim)
}

export function auctionIdFromPath(path: string) {
  return /^\/leiloes\/([a-f\d]{24})\/?$/i.exec(path)?.[1] ?? null
}

export function auctionHref(id: string, catalogUrl = '/') {
  const params = new URLSearchParams({ regresso: catalogUrl })
  return `/leiloes/${encodeURIComponent(id)}${catalogUrl === '/' ? '' : `?${params}`}`
}

export function auctionState(auction: Auction, now: number): Auction['estado'] {
  if (auction.estado === 'terminado' || now >= Date.parse(auction.dataFim)) return 'terminado'
  if (now < Date.parse(auction.dataInicio)) return 'agendado'
  return 'ativo'
}

export function featuredAuction(auctions: Auction[], now: number) {
  return auctions.filter((auction) => auctionState(auction, now) === 'ativo')
    .sort((a, b) => Date.parse(a.dataFim) - Date.parse(b.dataFim))[0] ?? null
}

export function remainingSeconds(endsAt: number, now: number) {
  return Math.max(0, Math.ceil((endsAt - now) / 1000))
}

export function formatRemaining(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts = [minutes, seconds % 60]
  if (hours > 0) parts.unshift(hours)
  return parts.map((part) => String(part).padStart(2, '0')).join(':')
}

export function bidInputValue(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function parseBid(value: string): number | null {
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}
