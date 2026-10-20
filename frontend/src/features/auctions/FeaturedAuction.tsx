import { useEffect, useState } from 'react'
import AuctionCard from '../../components/auction/AuctionCard'
import Button from '../../components/ui/Button'
import { productImages } from '../products/product'
import { auctionHref, featuredAuction } from './auction'

export default function FeaturedAuction() {
  const [auctions, setAuctions] = useState<unknown[]>([])
  const [now, setNow] = useState(Date.now)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined
    async function load() {
      try {
        const response = await fetch('/api/auctions', { signal: controller.signal })
        if (!response.ok) throw new Error('Leilões indisponíveis')
        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw new Error('Resposta inválida')
        if (!controller.signal.aborted) {
          setAuctions(data)
          setStatus('success')
        }
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(load, 5000)
      }
    }
    void load()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [retry])

  if (status === 'loading') return <p role="status">A carregar leilão…</p>
  if (status === 'error') return (
    <div className="home-page__error" role="alert">
      <p>Não foi possível carregar o leilão.</p>
      <Button onClick={() => { setStatus('loading'); setRetry((value) => value + 1) }}>Tentar novamente</Button>
    </div>
  )
  const auction = featuredAuction(auctions, now)
  if (!auction) return <p role="status">Não existem leilões ativos neste momento.</p>

  return <AuctionCard key={auction._id} auction={{
    name: auction.lote,
    lotDescription: auction.produtos.map(line => `${line.produtoId.nome}: ${line.quantidade} ${line.unidade}`).join(' · '),
    ...productImages(auction.produtos[0].produtoId),
    currentBid: auction.licitacaoAtual.valor,
    endsAt: Date.parse(auction.dataFim),
  }} href={auctionHref(auction._id, `/${window.location.search}${window.location.hash}`)} />
}
