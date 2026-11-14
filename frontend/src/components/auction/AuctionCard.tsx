import { useId } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faClock,
  faGavel,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import Button from "../ui/Button";
import ImageWithFallback from "../ui/ImageWithFallback";
import { priceFormatter } from "../../features/products/product";
import { formatRemaining } from "../../features/auctions/auction";
import { useAuctionCountdown } from "../../features/auctions/useAuctionCountdown";
import "./AuctionCard.scss";

export interface AuctionCardAuction {
  name: string;
  lotDescription: string;
  image?: string;
  srcSet?: string;
  currentBid: number;
  endsAt: number;
  startsAt?: string;
  basePrice?: number;
  participants?: number | null;
}

function AuctionCard({
  auction,
  onEnter,
  href,
  clockOffset = 0,
}: {
  auction: AuctionCardAuction;
  onEnter?: () => void;
  href?: string;
  clockOffset?: number;
}) {
  const id = useId();
  const { remaining } = useAuctionCountdown(auction.endsAt, clockOffset);
  const scheduled = auction.startsAt !== undefined;
  const ended = !scheduled && remaining === 0;
  const action = scheduled ? "Ver leilão" : "Entrar no leilão";

  return (
    <article className="auction-card" aria-labelledby={`${id}-title`}>
      <div className="auction-card__image-panel">
        <svg
          className="auction-card__wave"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            className="auction-card__wave"
            d="M45 0 C15 20 40 100 0 100 H100 V0 Z"
            fill="currentColor"
          />
        </svg>
        <ImageWithFallback
          className="auction-card__image"
          image={auction.image}
          srcSet={auction.srcSet}
          sizes="320px"
          alt={auction.name}
        />
      </div>

      <div className="auction-card__content">
        <div className="auction-card__status-row">
          <p className="auction-card__participants">
            <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
            {auction.participants == null
              ? "Participantes: indisponível"
              : `${auction.participants} ${auction.participants === 1 ? "participante" : "participantes"}`}
          </p>
          <span
            className={`auction-card__badge${scheduled ? " auction-card__badge--scheduled" : ""}`}
          >
            <span className="auction-card__status-dot" aria-hidden="true" />
            {scheduled ? "AGENDADO" : ended ? "TERMINADO" : "EM DIRETO"}
          </span>
        </div>
        <div className="auction-card__summary">
          <h3 className="auction-card__title" id={`${id}-title`}>
            {auction.name}
          </h3>
          <p className="auction-card__lot">{auction.lotDescription}</p>
        </div>

        <dl className="auction-card__metrics">
          <div className="auction-card__bid">
            <dt>
              <FontAwesomeIcon icon={faGavel} aria-hidden="true" />{" "}
              {scheduled ? "Preço base" : "Lance atual"}
            </dt>
            <dd>
              {priceFormatter.format(
                (auction.basePrice ?? auction.currentBid) / 100,
              )}
            </dd>
          </div>
          <div className="auction-card__countdown">
            <dt>
              <FontAwesomeIcon icon={faClock} aria-hidden="true" />{" "}
              {scheduled ? "Começa em" : "Termina em"}
            </dt>
            <dd>
              {scheduled ? (
                <time dateTime={auction.startsAt}>
                  {new Date(auction.startsAt!).toLocaleString("pt-PT", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
              ) : (
                formatRemaining(remaining)
              )}
            </dd>
          </div>
        </dl>

        <div className="auction-card__footer">
          {href && !ended ? (
            <Button
              href={href}
              className="auction-card__enter"
              icon={faArrowRight}
              iconPosition="end"
            >
              {action}
            </Button>
          ) : (
            <Button
              className="auction-card__enter"
              icon={faArrowRight}
              iconPosition="end"
              disabled={ended || !onEnter}
              onClick={onEnter}
            >
              {action}
            </Button>
          )}
        </div>
        <span className="auction-card__announcement" role="status">
          {ended ? "O leilão terminou." : ""}
        </span>
      </div>
    </article>
  );
}

export default AuctionCard;
