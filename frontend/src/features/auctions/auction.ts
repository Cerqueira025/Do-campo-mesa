export interface Auction {
  _id: string
  produtos: { produtoId: { nome: string }; quantidade: number; unidade: string }[]
  lote: string
  incremento: number
  dataInicio: string
  dataFim: string
  estado: 'agendado' | 'ativo' | 'terminado' | 'cancelado'
  reservaStock: 'pendente' | 'reservada' | 'libertada' | 'atribuida' | 'sem-reserva'
  motivoCancelamento?: keyof typeof cancellationMessages
  licitacaoAtual: { valor: number }
}

export const cancellationMessages = {
  'stock-insuficiente': 'O stock disponível não é suficiente para todos os produtos do lote.',
  'produto-indisponivel': 'Um dos produtos do lote já não está disponível ou foi alterado.',
  'produtor-indisponivel': 'O produtor já não está disponível para realizar o leilão.',
}

export function isAuction(value: unknown): value is Auction {
  if (!value || typeof value !== 'object') return false
  const auction = value as Auction
  return typeof auction._id === 'string' && /^[a-f\d]{24}$/i.test(auction._id) &&
    Array.isArray(auction.produtos) && auction.produtos.length > 0 && auction.produtos.every(line =>
      !!line?.produtoId && typeof line.produtoId.nome === 'string' &&
      Number.isFinite(line.quantidade) && line.quantidade > 0 && ['kg', 'g', 'l', 'unidade'].includes(line.unidade)) &&
    typeof auction.lote === 'string' && Number.isSafeInteger(auction.incremento) && auction.incremento > 0 &&
    Number.isSafeInteger(auction.licitacaoAtual?.valor) && auction.licitacaoAtual.valor >= 0 &&
    Number.isSafeInteger(auction.licitacaoAtual.valor + auction.incremento) &&
    ['agendado', 'ativo', 'terminado', 'cancelado'].includes(auction.estado) &&
    ['pendente', 'reservada', 'libertada', 'atribuida', 'sem-reserva'].includes(auction.reservaStock) &&
    (auction.estado !== 'cancelado' || Object.hasOwn(cancellationMessages, auction.motivoCancelamento ?? '')) &&
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
  if (auction.estado === 'cancelado') return 'cancelado'
  if (auction.estado === 'terminado' || now >= Date.parse(auction.dataFim)) return 'terminado'
  if (now < Date.parse(auction.dataInicio)) return 'agendado'
  return auction.estado === 'ativo' && auction.reservaStock === 'reservada' ? 'ativo' : 'agendado'
}

export function featuredAuction(auctions: unknown[], now: number) {
  return auctions.filter(isAuction).filter((auction) => auctionState(auction, now) === 'ativo')
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
