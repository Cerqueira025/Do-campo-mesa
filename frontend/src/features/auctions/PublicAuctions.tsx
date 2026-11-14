import { useEffect, useRef, useState, type ReactNode } from "react";
import { faAngleLeft, faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import AuctionCard from "../../components/auction/AuctionCard";
import Button from "../../components/ui/Button";
import IconButton from "../../components/ui/IconButton";
import { productImages } from "../products/product";
import {
  auctionHref,
  serverClockOffset,
  upcomingAuctions,
  type Auction,
} from "./auction";
import "./PublicAuctions.scss";

function AuctionStrip({ children }: { children: ReactNode }) {
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const element = strip.current!;
    const update = () => {
      const start = element.scrollLeft <= 1;
      const end =
        element.scrollWidth - element.clientWidth - element.scrollLeft <= 1;
      setEdges((current) =>
        current.start === start && current.end === end
          ? current
          : { start, end },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const card of element.children) observer.observe(card);
    element.addEventListener("scroll", update);
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [children]);

  function slide(direction: number) {
    const element = strip.current;
    if (!element) return;
    const [first, second] = element.children;
    if (!first || !second) return;
    const step =
      second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    element.scrollBy({
      left: step * direction,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <div className="public-auctions__carousel">
      <div className="public-auctions__strip" ref={strip}>
        {children}
      </div>
      {!(edges.start && edges.end) && (
        <>
          <IconButton
            className="public-auctions__arrow public-auctions__arrow--previous"
            aria-label="Leilão anterior"
            icon={<FontAwesomeIcon icon={faAngleLeft} aria-hidden="true" />}
            disabled={edges.start}
            onClick={() => slide(-1)}
          />
          <IconButton
            className="public-auctions__arrow public-auctions__arrow--next"
            aria-label="Leilão seguinte"
            icon={<FontAwesomeIcon icon={faAngleRight} aria-hidden="true" />}
            disabled={edges.end}
            onClick={() => slide(1)}
          />
        </>
      )}
    </div>
  );
}

export default function PublicAuctions({
  listing = false,
}: {
  listing?: boolean;
}) {
  const [auctions, setAuctions] = useState<unknown[]>([]);
  const [now, setNow] = useState(Date.now);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    async function load() {
      try {
        const response = await fetch("/api/auctions", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Leilões indisponíveis");
        const receivedAt = Date.now();
        const nextOffset = serverClockOffset(
          response.headers.get("Date"),
          receivedAt,
        );
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("Resposta inválida");
        if (!controller.signal.aborted) {
          setAuctions(data);
          setOffset(nextOffset);
          setNow(receivedAt + nextOffset);
          setStatus("success");
        }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(load, 5000);
      }
    }
    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [retry]);

  if (status === "loading") return <p role="status">A carregar leilões…</p>;
  if (status === "error")
    return (
      <div role="alert">
        <p>Não foi possível carregar os leilões.</p>
        <Button
          onClick={() => {
            setStatus("loading");
            setRetry((value) => value + 1);
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  const { active, scheduled } = upcomingAuctions(auctions, now);
  const origin = listing
    ? "/leiloes"
    : `/${window.location.search}${window.location.hash}`;

  const card = (auction: Auction, scheduled: boolean) => (
    <AuctionCard
      key={auction._id}
      clockOffset={offset}
      auction={{
        name: auction.lote,
        lotDescription: auction.produtos
          .map(
            (line) =>
              `${line.produtoId.nome}: ${line.quantidade} ${line.unidade}`,
          )
          .join(" · "),
        ...productImages(auction.produtos[0].produtoId),
        currentBid: auction.licitacaoAtual.valor,
        endsAt: Date.parse(auction.dataFim),
        ...(scheduled && {
          startsAt: auction.dataInicio,
          basePrice: auction.precoBase ?? auction.licitacaoAtual.valor,
        }),
      }}
      href={auctionHref(auction._id, origin)}
    />
  );
  const activeCards = active.map((auction) => card(auction, false));
  const scheduledCards = scheduled.map((auction) => card(auction, true));

  if (!listing) {
    const cards = [...activeCards, ...scheduledCards].slice(0, 6);
    return cards.length ? (
      <AuctionStrip>{cards}</AuctionStrip>
    ) : (
      <p role="status">
        Não existem leilões ativos ou agendados neste momento.
      </p>
    );
  }

  return (
    <>
      <section aria-labelledby="live-auctions">
        <h2 id="live-auctions">Em direto</h2>
        {activeCards.length ? (
          <div className="public-auctions__grid">{activeCards}</div>
        ) : (
          <p>Não existem leilões ativos neste momento.</p>
        )}
      </section>
      <section aria-labelledby="scheduled-auctions">
        <h2 id="scheduled-auctions">Agendados</h2>
        {scheduledCards.length ? (
          <div className="public-auctions__grid">{scheduledCards}</div>
        ) : (
          <p>Não existem leilões agendados neste momento.</p>
        )}
      </section>
    </>
  );
}
