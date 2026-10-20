import InternalLink from '../navigation/InternalLink'
import { restoreNavigation, returnToCatalog } from '../navigation/navigation'
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder'
import { useEffect, useId, useLayoutEffect, useState } from 'react'
import { faArrowLeft, faArrowRight, faUsers } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Button from '../components/ui/Button'
import IconButton from '../components/ui/IconButton'
import ProductImage from '../components/product/ProductImage'
import { catalogReturnUrl, priceFormatter, productImages } from '../features/products/product'
import { cancellationMessages, auctionState, bidInputValue, formatRemaining, isAuction, parseBid, remainingSeconds, type Auction } from '../features/auctions/auction'
import { useAuctionCountdown } from '../features/auctions/useAuctionCountdown'
import './AuctionDetailPage.scss'

function AuctionContent({ auction }: { auction: Auction }) {
  const id = useId()
  const { now, remaining } = useAuctionCountdown(Date.parse(auction.dataFim))
  const state = auctionState(auction, now)
  const active = state === 'ativo'
  const closed = state === 'terminado' || state === 'cancelado'
  const waiting = state === 'agendado' && now >= Date.parse(auction.dataInicio)
  const minimum = auction.licitacaoAtual.valor + auction.incremento
  const [amount, setAmount] = useState(() => bidInputValue(minimum))
  const bid = parseBid(amount)
  const invalid = bid === null || bid < minimum
  const stateLabel = state === 'ativo' ? 'EM DIRETO' : state === 'agendado' ? 'AGENDADO' : state === 'cancelado' ? 'CANCELADO' : 'TERMINADO'

  return (
    <>
      <header className="auction-detail__hero">
        <ProductImage {...productImages(auction.produtos[0].produtoId)} alt={auction.produtos[0].produtoId.nome} className="auction-detail__image" sizes="(min-width: 768px) 640px, 100vw" loading="eager" />
        <div className="auction-detail__indicators">
          <span className="auction-detail__badge">
            {active && <span className="auction-detail__live-dot" aria-hidden="true" />}{stateLabel}
          </span>
          <div className="auction-detail__timer">
            <span>{state === 'cancelado' ? 'Leilão cancelado' : waiting ? 'A aguardar confirmação' : state === 'agendado' ? 'Começa em' : state === 'terminado' ? 'Leilão terminado' : 'Termina em'}</span>
            <strong>{formatRemaining(closed ? 0 : state === 'agendado' ? remainingSeconds(Date.parse(auction.dataInicio), now) : remaining)}</strong>
          </div>
          <p className="auction-detail__participants"><FontAwesomeIcon icon={faUsers} aria-hidden="true" /> Participantes: indisponível</p>
        </div>
        <div className="auction-detail__summary">
          <h1>{auction.lote}</h1>
          <dl className="auction-detail__metrics">
            <div className="auction-detail__current"><dt>Lance atual</dt><dd>{priceFormatter.format(auction.licitacaoAtual.valor / 100)}</dd></div>
            <div className="auction-detail__last"><dt>A sua última licitação</dt><dd>— €</dd><span>Indisponível</span></div>
          </dl>
        </div>
      </header>
      <form className="auction-detail__form" aria-label="Preparar licitação" onSubmit={(event) => event.preventDefault()}>
        {state === 'cancelado' && <p role="status">Leilão cancelado. {auction.motivoCancelamento && cancellationMessages[auction.motivoCancelamento]}</p>}
        {waiting && <p role="status">A aguardar confirmação de disponibilidade do lote.</p>}
        <section className="auction-detail__products" aria-labelledby={`${id}-products`}>
          <h2 id={`${id}-products`}>Produtos do lote</h2>
          <ul>{auction.produtos.map((line, index) => <li key={index}>
            {line.produtoId.nome} · {new Intl.NumberFormat('pt-PT').format(line.quantidade)} {line.unidade}
          </li>)}</ul>
        </section>
        <div className="auction-detail__increments" role="group" aria-label="Adicionar ao lance atual">
          {[500, 1000, 2500].map((increment) => (
            <Button key={increment} variant="cream" className="auction-detail__increment"
              disabled={!active || increment < auction.incremento || !Number.isSafeInteger(auction.licitacaoAtual.valor + increment)}
              onClick={() => setAmount(bidInputValue(auction.licitacaoAtual.valor + increment))}>
              +{increment / 100} €
            </Button>
          ))}
        </div>
        <label htmlFor={`${id}-amount`}>O seu lance</label>
        <div className="auction-detail__input-group">
          <input id={`${id}-amount`} type="text" inputMode="decimal" autoComplete="off" value={amount}
            disabled={!active} onChange={(event) => setAmount(event.target.value)}
            aria-invalid={active && invalid} aria-describedby={`${id}-minimum ${id}-availability${active && invalid ? ` ${id}-error` : ''}`} />
          <span aria-hidden="true">€</span>
        </div>
        <p id={`${id}-minimum`} className="auction-detail__hint">Lance mínimo: {priceFormatter.format(minimum / 100)}</p>
        {active && invalid && <p id={`${id}-error`} className="auction-detail__error" role="alert">Introduza um valor com até duas casas decimais, igual ou superior ao lance mínimo.</p>}
        <Button className="auction-detail__submit" icon={faArrowRight} iconPosition="end" disabled aria-describedby={`${id}-availability`}>
          {state === 'cancelado' ? 'Leilão cancelado' : state === 'terminado' ? 'Leilão terminado' : state === 'agendado' ? 'Leilão agendado' : bid !== null && !invalid ? `Licitar ${priceFormatter.format(bid / 100)}` : 'Licitar'}
        </Button>
        <p id={`${id}-availability`} className="auction-detail__hint">As licitações ainda não estão disponíveis.</p>
        <span className="auction-detail__announcement" role="status">{state === 'cancelado' ? 'O leilão foi cancelado.' : state === 'terminado' ? 'O leilão terminou.' : ''}</span>
      </form>
    </>
  )
}

export default function AuctionDetailPage({ id }: { id: string | null }) {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'missing' | 'error'>(id ? 'loading' : 'missing')
  const [retry, setRetry] = useState(0)
  const returnUrl = catalogReturnUrl(window.location.search)
  useLayoutEffect(() => { restoreNavigation(status !== 'loading') }, [status])

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    let timer: number | undefined
    async function load() {
      try {
        const response = await fetch(`/api/auctions/${id}`, { signal: controller.signal })
        if (response.status === 404) {
          if (!controller.signal.aborted) setStatus('missing')
          return
        }
        if (!response.ok) throw new Error('Leilão indisponível')
        const data: unknown = await response.json()
        if (!isAuction(data) || data._id.toLowerCase() !== id!.toLowerCase()) throw new Error('Resposta inválida')
        if (!controller.signal.aborted) { setAuction(data); setStatus('success') }
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(load, 5000)
      }
    }
    void load()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [id, retry])

  useEffect(() => {
    const previousTitle = document.title
    document.title = auction ? `${auction.lote} · Leilão · Do campo à mesa` : 'Leilão · Do campo à mesa'
    return () => { document.title = previousTitle }
  }, [auction])

  return (
    <main data-navigation-ready={status !== 'loading'} className={`auction-detail${status === 'success' ? ' auction-detail--loaded' : ''}`}>
      <nav className="auction-detail__back" aria-label="Regresso ao catálogo">
        <IconButton aria-label="Voltar ao catálogo" icon={<FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />}
          onClick={() => returnToCatalog(returnUrl)} />
      </nav>
      {status === 'loading' ? <LoadingPlaceholder label="A carregar leilão…" /> : status === 'missing' ? (
        <section className="auction-detail__message"><h1>Leilão não encontrado</h1><p>Este leilão não existe ou já não está disponível.</p><InternalLink href={returnUrl}>Explorar produtos</InternalLink></section>
      ) : status === 'error' ? (
        <section className="auction-detail__message" role="alert"><h1>Não foi possível carregar o leilão</h1><p>Tenta novamente dentro de instantes.</p>
          <Button onClick={() => { setStatus('loading'); setRetry((value) => value + 1) }}>Tentar novamente</Button>
        </section>
      ) : auction && <AuctionContent key={auction._id} auction={auction} />}
    </main>
  )
}
