import { useEffect, useId, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faClock, faGavel, faUsers } from '@fortawesome/free-solid-svg-icons'
import Button from '../ui/Button'
import './AuctionCard.scss'

export interface AuctionCardAuction {
  name: string
  lotDescription: string
  image: string
  currentBid: number
  endsAt: number
  participants: number
}

const priceFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

function formatRemaining(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts = [minutes, seconds % 60]
  if (hours > 0) parts.unshift(hours)
  return parts.map((part) => String(part).padStart(2, '0')).join(':')
}

function AuctionCard({ auction }: { auction: AuctionCardAuction }) {
  const id = useId()
  const [now, setNow] = useState(Date.now)
  const remaining = Math.max(0, Math.ceil((auction.endsAt - now) / 1000))
  const ended = remaining === 0

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentTime = Date.now()
      setNow(currentTime)
      if (currentTime >= auction.endsAt) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [auction.endsAt])

  return (
    <article className="auction-card" aria-labelledby={`${id}-title`}>
      <div className="auction-card__image-panel">
        <svg className="auction-card__wave" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path className="auction-card__wave" d="M45 0 C15 20 40 100 0 100 H100 V0 Z" fill="currentColor" />
        </svg>
        <img className="auction-card__image" src={auction.image} alt="" />
      </div>

      <div className="auction-card__content">
        <div className="auction-card__status-row">
          <p className="auction-card__participants">
            <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
            {auction.participants} {auction.participants === 1 ? 'participante' : 'participantes'}
          </p>
          <span className="auction-card__badge">
            <span className="auction-card__status-dot" aria-hidden="true" />
            {ended ? 'TERMINADO' : 'EM DIRETO'}
          </span>
        </div>
        <div className="auction-card__summary">
          <h2 className="auction-card__title" id={`${id}-title`}>{auction.name}</h2>
          <p className="auction-card__lot">{auction.lotDescription}</p>
        </div>

        <dl className="auction-card__metrics">
          <div className="auction-card__bid">
            <dt><FontAwesomeIcon icon={faGavel} aria-hidden="true" /> Lance atual</dt>
            <dd>{priceFormatter.format(auction.currentBid / 100)}</dd>
          </div>
          <div className="auction-card__countdown">
            <dt><FontAwesomeIcon icon={faClock} aria-hidden="true" /> Termina em</dt>
            <dd>{formatRemaining(remaining)}</dd>
          </div>
        </dl>

        <div className="auction-card__footer">
          <Button className="auction-card__enter" variant="primary" icon={faArrowRight}
            iconPosition="end" disabled aria-describedby={`${id}-availability`}>
            Entrar no leilão
          </Button>
        </div>
        <span className="auction-card__announcement" role="status">{ended ? 'O leilão terminou.' : ''}</span>
      </div>
    </article>
  )
}

export default AuctionCard
