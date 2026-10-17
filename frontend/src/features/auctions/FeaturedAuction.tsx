import { useEffect, useState } from 'react'
import AuctionCard from '../../components/auction/AuctionCard'
import Button from '../../components/ui/Button'
import { productImages } from '../products/product'
import { auctionHref, featuredAuction, isAuction, type Auction } from './auction'

export default function FeaturedAuction() {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/auctions?estado=ativo', { signal: controller.signal })
        if (!response.ok) throw new Error('Leilões indisponíveis')
        const data: unknown = await response.json()
        if (!Array.isArray(data) || !data.every(isAuction)) throw new Error('Resposta inválida')
        if (!controller.signal.aborted) {
          setAuction(featuredAuction(data, Date.now()))
          setStatus('success')
        }
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }
    void load()
    return () => controller.abort()
  }, [retry])

  if (status === 'loading') return <p role="status">A carregar leilão…</p>
  if (status === 'error') return (
    <div className="home-page__error" role="alert">
      <p>Não foi possível carregar o leilão.</p>
      <Button onClick={() => { setStatus('loading'); setRetry((value) => value + 1) }}>Tentar novamente</Button>
    </div>
  )
  if (!auction?.produtoId) return <p role="status">Não existem leilões ativos neste momento.</p>

  return <AuctionCard key={auction._id} auction={{
    name: auction.produtoId.nome,
    lotDescription: auction.lote,
    ...productImages(auction.produtoId),
    currentBid: auction.licitacaoAtual.valor,
    endsAt: Date.parse(auction.dataFim),
  }} href={auctionHref(auction._id, `/${window.location.search}${window.location.hash}`)} />
}
