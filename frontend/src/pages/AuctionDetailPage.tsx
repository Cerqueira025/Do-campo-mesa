import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { faArrowRight, faUsers } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import InternalLink from "../navigation/InternalLink";
import { restoreNavigation, returnToCatalog } from "../navigation/navigation";
import LoadingPlaceholder from "../components/ui/LoadingPlaceholder";
import Button from "../components/ui/Button";
import ImageWithFallback from "../components/ui/ImageWithFallback";
import AppHeader from "../components/layout/AppHeader";
import { useAuth } from "../features/auth/useAuth";
import { authHref } from "../features/auth/auth";
import { useSocket } from "../features/realtime/socketContext";
import {
  catalogReturnUrl,
  priceFormatter,
  productImages,
} from "../features/products/product";
import {
  cancellationMessages,
  auctionState,
  bidInputValue,
  formatRemaining,
  isAuction,
  parseBid,
  remainingSeconds,
  type Auction,
  type AuctionBid,
} from "../features/auctions/auction";
import { useAuctionCountdown } from "../features/auctions/useAuctionCountdown";
import "./AuctionDetailPage.scss";

interface LiveProps {
  navigation: ReactNode;
  auction: Auction;
  bids: AuctionBid[];
  ownBid: AuctionBid | null;
  participants: number | null;
  connected: boolean;
  offset: number;
  error: string;
  busy: boolean;
  onBid: (value: number) => void;
}

function AuctionContent({
  navigation,
  auction,
  bids,
  ownBid,
  participants,
  connected,
  offset,
  error,
  busy,
  onBid,
}: LiveProps) {
  const id = useId();
  const { utilizador } = useAuth();
  const { now, remaining } = useAuctionCountdown(
    Date.parse(auction.dataFim),
    offset,
  );
  const state = auctionState(auction, now);
  const active = state === "ativo";
  const closed = state === "terminado" || state === "cancelado";
  const waiting = state === "agendado" && now >= Date.parse(auction.dataInicio);
  const minimum = auction.licitacaoAtual.valor + auction.incremento;
  const [draft, setDraft] = useState<{
    minimum: number;
    amount: string;
  } | null>(null);
  const amount =
    draft?.minimum === minimum ? draft.amount : bidInputValue(minimum);
  const setAmount = (value: string) => setDraft({ minimum, amount: value });
  const bid = parseBid(amount);
  const invalid = bid === null || bid < minimum;
  const canBid = utilizador?.papel === "comprador" && connected && active;
  const stateLabel =
    state === "ativo"
      ? "EM DIRETO"
      : state === "agendado"
        ? "AGENDADO"
        : state === "cancelado"
          ? "CANCELADO"
          : "TERMINADO";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canBid && !invalid && !busy && bid !== null) onBid(bid);
  }

  return (
    <>
      <section className="auction-detail__hero">
        {navigation}
        <ImageWithFallback
          {...productImages(auction.produtos[0].produtoId)}
          alt={auction.produtos[0].produtoId.nome}
          className="auction-detail__image"
          sizes="(min-width: 768px) 640px, 100vw"
          loading="eager"
        />
        <div className="auction-detail__indicators">
          <span className="auction-detail__badge">
            {active && (
              <span className="auction-detail__live-dot" aria-hidden="true" />
            )}
            {stateLabel}
          </span>
          <div className="auction-detail__timer">
            <span>
              {state === "cancelado"
                ? "Leilão cancelado"
                : waiting
                  ? "A aguardar confirmação"
                  : state === "agendado"
                    ? "Começa em"
                    : state === "terminado"
                      ? "Leilão terminado"
                      : "Termina em"}
            </span>
            <strong>
              {formatRemaining(
                closed
                  ? 0
                  : state === "agendado"
                    ? remainingSeconds(Date.parse(auction.dataInicio), now)
                    : remaining,
              )}
            </strong>
          </div>
          <p className="auction-detail__participants">
            <FontAwesomeIcon icon={faUsers} aria-hidden="true" /> A assistir:{" "}
            {participants ?? "—"}
          </p>
        </div>
        <div className="auction-detail__summary page-content">
          <h1>{auction.lote}</h1>
          <dl className="auction-detail__metrics">
            <div className="auction-detail__current">
              <dt>Lance atual</dt>
              <dd>
                {priceFormatter.format(auction.licitacaoAtual.valor / 100)}
              </dd>
            </div>
            <div className="auction-detail__last">
              <dt>A sua última licitação</dt>
              <dd>
                {ownBid ? priceFormatter.format(ownBid.valor / 100) : "—"}
              </dd>
              <span>
                {ownBid
                  ? ownBid.valor === auction.licitacaoAtual.valor
                    ? "É o lance mais alto"
                    : "Ultrapassada"
                  : "Ainda não licitou"}
              </span>
            </div>
          </dl>
        </div>
      </section>
      <form
        className="auction-detail__form page-content"
        aria-label="Licitar no leilão"
        onSubmit={submit}
      >
        {state === "cancelado" && (
          <p role="status">
            Leilão cancelado.{" "}
            {auction.motivoCancelamento &&
              cancellationMessages[auction.motivoCancelamento]}
          </p>
        )}
        {waiting && (
          <p role="status">
            A aguardar confirmação de disponibilidade do lote.
          </p>
        )}
        <section
          className="auction-detail__products"
          aria-labelledby={`${id}-products`}
        >
          <h2 id={`${id}-products`}>Produtos do lote</h2>
          <ul>
            {auction.produtos.map((line, index) => (
              <li key={index}>
                {line.produtoId.nome} ·{" "}
                {new Intl.NumberFormat("pt-PT").format(line.quantidade)}{" "}
                {line.unidade}
              </li>
            ))}
          </ul>
        </section>
        <div
          className="auction-detail__increments"
          role="group"
          aria-label="Adicionar ao lance atual"
        >
          {[500, 1000, 2500].map((increment) => (
            <Button
              key={increment}
              variant="cream"
              className="auction-detail__increment"
              disabled={
                !canBid ||
                busy ||
                increment < auction.incremento ||
                !Number.isSafeInteger(auction.licitacaoAtual.valor + increment)
              }
              onClick={() =>
                setAmount(
                  bidInputValue(auction.licitacaoAtual.valor + increment),
                )
              }
            >
              +{increment / 100} €
            </Button>
          ))}
        </div>
        <label htmlFor={`${id}-amount`}>O seu lance</label>
        <div className="auction-detail__input-group">
          <input
            id={`${id}-amount`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            disabled={!canBid || busy}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={canBid && invalid}
            aria-describedby={`${id}-minimum ${id}-availability${canBid && invalid ? ` ${id}-error` : ""}`}
          />
          <span aria-hidden="true">€</span>
        </div>
        <p id={`${id}-minimum`} className="auction-detail__hint">
          Lance mínimo: {priceFormatter.format(minimum / 100)}
        </p>
        {canBid && invalid && (
          <p id={`${id}-error`} className="auction-detail__error" role="alert">
            Introduza um valor com até duas casas decimais, igual ou superior ao
            lance mínimo.
          </p>
        )}
        {error && (
          <p className="auction-detail__error" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="auction-detail__submit"
          icon={faArrowRight}
          iconPosition="end"
          disabled={!canBid || invalid || busy}
          aria-describedby={`${id}-availability`}
        >
          {busy
            ? "A confirmar lance…"
            : state === "cancelado"
              ? "Leilão cancelado"
              : state === "terminado"
                ? "Leilão terminado"
                : state === "agendado"
                  ? "Leilão agendado"
                  : bid !== null && !invalid
                    ? `Licitar ${priceFormatter.format(bid / 100)}`
                    : "Licitar"}
        </Button>
        <p id={`${id}-availability`} className="auction-detail__hint">
          {!connected ? (
            "Ligação em tempo real indisponível. Os dados serão atualizados automaticamente."
          ) : !utilizador ? (
            <InternalLink
              href={authHref("/login", {
                regresso: window.location.pathname + window.location.search,
              })}
            >
              Inicie sessão para licitar.
            </InternalLink>
          ) : utilizador.papel !== "comprador" ? (
            "Apenas compradores podem licitar."
          ) : active ? (
            "Lances confirmados pelo servidor."
          ) : (
            "As licitações não estão disponíveis neste momento."
          )}
        </p>
        <section className="auction-detail__history">
          <h2>Últimas licitações</h2>
          {bids.length ? (
            <ol>
              {bids.map((item) => (
                <li key={item._id}>
                  {item.nome}: {priceFormatter.format(item.valor / 100)}
                </li>
              ))}
            </ol>
          ) : (
            <p>Ainda não há licitações.</p>
          )}
        </section>
        <span className="auction-detail__announcement" role="status">
          {state === "cancelado"
            ? "O leilão foi cancelado."
            : state === "terminado"
              ? "O leilão terminou."
              : ""}
        </span>
      </form>
    </>
  );
}

export default function AuctionDetailPage({ id }: { id: string | null }) {
  const socket = useSocket();
  const { utilizador } = useAuth();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [ownBid, setOwnBid] = useState<AuctionBid | null>(null);
  const [participants, setParticipants] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [offset, setOffset] = useState(0);
  const [bidError, setBidError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [status, setStatus] = useState<
    "loading" | "success" | "missing" | "error"
  >(id ? "loading" : "missing");
  const [retry, setRetry] = useState(0);
  const returnUrl = catalogReturnUrl(window.location.search);
  useLayoutEffect(() => {
    restoreNavigation(status !== "loading");
  }, [status]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let timer: number | undefined;
    async function load() {
      try {
        const response = await fetch(`/api/auctions/${id}`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          if (!controller.signal.aborted) setStatus("missing");
          return;
        }
        if (!response.ok) throw new Error("Leilão indisponível");
        const data: unknown = await response.json();
        if (!isAuction(data) || data._id.toLowerCase() !== id!.toLowerCase())
          throw new Error("Resposta inválida");
        if (!controller.signal.aborted) {
          setAuction((previous) =>
            previous &&
            previous.licitacaoAtual.valor > data.licitacaoAtual.valor
              ? previous
              : data,
          );
          setStatus("success");
        }
      } catch {
        if (!controller.signal.aborted)
          setStatus((previous) =>
            previous === "success" ? previous : "error",
          );
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(load, 5000);
      }
    }
    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [id, retry]);

  useEffect(() => {
    if (!id || !socket) return;
    const enter = () => {
      setConnected(true);
      socket.emit("entrar", id, (answer: { ok: boolean; erro?: string }) => {
        if (!answer.ok)
          setBidError(answer.erro ?? "Não foi possível entrar no leilão.");
      });
    };
    const disconnect = () => {
      setConnected(false);
      setParticipants(null);
    };
    const state = ({
      agora,
      leilao,
      licitacoes,
      ultimaLicitacaoPropria,
    }: {
      agora: string;
      leilao: unknown;
      licitacoes: AuctionBid[];
      ultimaLicitacaoPropria?: AuctionBid | null;
    }) => {
      if (!isAuction(leilao) || leilao._id.toLowerCase() !== id.toLowerCase())
        return;
      setOffset(Date.parse(agora) - Date.now());
      setAuction((previous) =>
        previous && previous.licitacaoAtual.valor > leilao.licitacaoAtual.valor
          ? previous
          : leilao,
      );
      setBids((previous) =>
        [...licitacoes, ...previous]
          .filter(
            (item, index, all) =>
              all.findIndex((candidate) => candidate._id === item._id) ===
              index,
          )
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 20),
      );
      setOwnBid((previous) => {
        const current =
          previous?.compradorId === utilizador?.id ? previous : null;
        return !ultimaLicitacaoPropria ||
          (current && current.valor > ultimaLicitacaoPropria.valor)
          ? current
          : ultimaLicitacaoPropria;
      });
      setStatus("success");
      setBidError("");
    };
    const newBid = (bid: AuctionBid) => {
      setAuction((previous) =>
        previous && bid.valor > previous.licitacaoAtual.valor
          ? {
              ...previous,
              licitacaoAtual: {
                valor: bid.valor,
                compradorId: bid.compradorId,
              },
            }
          : previous,
      );
      setBids((previous) =>
        [bid, ...previous.filter((item) => item._id !== bid._id)]
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 20),
      );
      if (bid.compradorId === utilizador?.id)
        setOwnBid((previous) =>
          previous && previous.valor > bid.valor ? previous : bid,
        );
    };
    const changed = () => setRetry((value) => value + 1);
    socket.on("connect", enter);
    socket.on("disconnect", disconnect);
    socket.on("estado", state);
    socket.on("nova-licitacao", newBid);
    socket.on("presenca", setParticipants);
    socket.on("aberto", changed);
    socket.on("terminado", changed);
    socket.on("cancelado", changed);
    if (socket.connected) enter();
    return () => {
      socket.emit("sair", id);
      socket.off("connect", enter);
      socket.off("disconnect", disconnect);
      socket.off("estado", state);
      socket.off("nova-licitacao", newBid);
      socket.off("presenca", setParticipants);
      socket.off("aberto", changed);
      socket.off("terminado", changed);
      socket.off("cancelado", changed);
    };
  }, [id, socket, utilizador?.id]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = auction
      ? `${auction.lote} · Leilão · Do campo à mesa`
      : "Leilão · Do campo à mesa";
    return () => {
      document.title = previousTitle;
    };
  }, [auction]);

  function placeBid(value: number) {
    if (!socket?.connected || !id || pending.current) return;
    pending.current = true;
    setBusy(true);
    setBidError("");
    socket
      .timeout(7000)
      .emit(
        "licitar",
        { leilaoId: id, valor: value },
        (failure: Error | null, answer?: { ok: boolean; erro?: string }) => {
          pending.current = false;
          setBusy(false);
          if (failure || !answer?.ok) {
            setBidError(
              answer?.erro ??
                "Resultado incerto. Consulte o histórico antes de tentar novamente.",
            );
            setRetry((current) => current + 1);
          }
        },
      );
  }

  const navigation = (
    <div className="auction-detail__top-row">
      <AppHeader
        variant={status === "success" ? "overlay" : "default"}
        onBack={() => returnToCatalog(returnUrl)}
      />
    </div>
  );

  return (
    <main
      data-navigation-ready={status !== "loading"}
      className={`auction-detail${status === "success" ? " auction-detail--loaded" : ""}`}
    >
      {status !== "success" && navigation}
      {status === "loading" ? (
        <LoadingPlaceholder label="A carregar leilão…" />
      ) : status === "missing" ? (
        <section className="auction-detail__message page-content">
          <h1>Leilão não encontrado</h1>
          <p>Este leilão não existe ou já não está disponível.</p>
          <InternalLink href={returnUrl}>Explorar produtos</InternalLink>
        </section>
      ) : status === "error" ? (
        <section className="auction-detail__message page-content" role="alert">
          <h1>Não foi possível carregar o leilão</h1>
          <p>Tenta novamente dentro de instantes.</p>
          <Button
            onClick={() => {
              setStatus("loading");
              setRetry((value) => value + 1);
            }}
          >
            Tentar novamente
          </Button>
        </section>
      ) : (
        auction && (
          <AuctionContent
            navigation={navigation}
            auction={auction}
            bids={bids}
            ownBid={ownBid?.compradorId === utilizador?.id ? ownBid : null}
            participants={participants}
            connected={connected}
            offset={offset}
            error={bidError}
            busy={busy}
            onBid={placeBid}
          />
        )
      )}
    </main>
  );
}
