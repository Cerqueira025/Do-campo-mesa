import "../products/ProducerProducts.scss";
import { useEffect, useState } from "react";
import {
  faArrowLeft,
  faArrowRight,
  faEyeSlash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAuth } from "../auth/useAuth";
import Button from "../../components/ui/Button";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import { navigate, restoreNavigation } from "../../navigation/navigation";
import { producerPage } from "../products/management";
import { priceFormatter } from "../products/product";
import { cancellationMessages, type Auction } from "./auction";
import ProducerAuctionHistory from "./ProducerAuctionHistory";
import "./ProducerAuctions.scss";

export interface ProducerAuction extends Omit<
  Auction,
  "produtos" | "licitacaoAtual"
> {
  produtos: {
    produtoId: { _id: string; nome: string } | null;
    quantidade: number;
    unidade: string;
  }[];
  precoBase: number;
  visivel: boolean;
  licitacaoAtual: { valor: number };
}
interface AuctionPage {
  items: ProducerAuction[];
  page: number;
  limit: number;
  total: number;
}
const labels = {
  agendado: "Agendado",
  ativo: "Ativo",
  terminado: "Terminado",
  cancelado: "Cancelado",
};
const stateFilters = [
  { value: "", label: "Todos" },
  { value: "agendado", label: "Agendados" },
  { value: "ativo", label: "Ativos" },
  { value: "terminado", label: "Terminados" },
  { value: "cancelado", label: "Cancelados" },
];
const listPath = "/produtor/leiloes";

function listHref(page: number, filters: string) {
  const params = new URLSearchParams(filters);
  if (page > 1) params.set("page", String(page));
  return params.size ? `${listPath}?${params}` : listPath;
}
const date = (value: string) =>
  new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const time = (value: string) =>
  new Date(value).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

function AuctionSummary({
  auction,
  href,
}: {
  auction: ProducerAuction;
  href?: string;
}) {
  const value = (
    <div className="producer-auctions__value">
      <dt>Valor atual</dt>
      <dd>{priceFormatter.format(auction.licitacaoAtual.valor / 100)}</dd>
    </div>
  );
  const products = (
    <ul className="producer-auctions__products" aria-label="Produtos do lote">
      {auction.produtos.map((line, index) => (
        <li key={index}>
          <span>{line.produtoId?.nome ?? "Produto indisponível"}</span>
          <strong>
            {line.quantidade} {line.unidade}
          </strong>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <div className="producer-auctions__card-heading">
        <h2 className="producer-auctions__title">{auction.lote}</h2>
        {!auction.visivel && (
          <span className="producer-auctions__visibility">
            <FontAwesomeIcon icon={faEyeSlash} aria-hidden="true" />
            Indisponível publicamente
          </span>
        )}
        <span
          className={`producer-auctions__status producer-auctions__status--${auction.estado}`}
        >
          <span aria-hidden="true" className="producer-auctions__status-dot" />
          {labels[auction.estado]}
        </span>
      </div>
      <div className="producer-auctions__body">
        {href && products}
        <dl className="producer-auctions__metrics">
          {!href && value}
          <div>
            <dt>Início</dt>
            <dd>
              <time dateTime={auction.dataInicio}>
                {date(auction.dataInicio)}
                <span>{time(auction.dataInicio)}</span>
              </time>
            </dd>
          </div>
          <div>
            <dt>Fim</dt>
            <dd>
              <time dateTime={auction.dataFim}>
                {date(auction.dataFim)}
                <span>{time(auction.dataFim)}</span>
              </time>
            </dd>
          </div>
          {href ? (
            value
          ) : (
            <>
              <div>
                <dt>Preço base</dt>
                <dd>{priceFormatter.format(auction.precoBase / 100)}</dd>
              </div>
              <div>
                <dt>Incremento mínimo</dt>
                <dd>{priceFormatter.format(auction.incremento / 100)}</dd>
              </div>
            </>
          )}
        </dl>
        {href ? (
          <Button
            className="producer-auctions__consult"
            href={href}
            variant="cream"
            icon={faArrowRight}
            iconPosition="end"
          >
            Consultar leilão{" "}
            <span className="producer-products__sr-only">{auction.lote}</span>
          </Button>
        ) : (
          <div className="producer-auctions__lot">
            <h3>Produtos do lote</h3>
            {auction.produtos.length ? products : <p>Sem produtos no lote.</p>}
          </div>
        )}
      </div>
    </>
  );
}

export default function ProducerAuctions({ id }: { id?: string }) {
  const { request } = useAuth();
  const search = window.location.search;
  const params = new URLSearchParams(search);
  const page = producerPage(search);
  const state =
    stateFilters.find(({ value }) => value === params.get("estado"))?.value ??
    "";
  const unavailable = params.get("visibilidade") === "indisponivel";
  const filters = new URLSearchParams();
  if (state) filters.set("estado", state);
  if (unavailable) filters.set("visibilidade", "indisponivel");
  const query = filters.toString();
  const requestPath = id
    ? `/auctions/mine/${id}`
    : `/auctions/mine?page=${page}&limit=24${query ? `&${query}` : ""}`;
  const [result, setResult] = useState<{
    path: string;
    data?: AuctionPage | ProducerAuction;
    error?: string;
  }>();
  const current = result?.path === requestPath ? result : undefined;
  const { data, error } = current ?? {};
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void request<AuctionPage | ProducerAuction>(requestPath, {
      signal: controller.signal,
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        if (
          "items" in value &&
          page > Math.max(1, Math.ceil(value.total / value.limit))
        ) {
          navigate(
            listHref(Math.max(1, Math.ceil(value.total / value.limit)), query),
            { replace: true, preserveScroll: true },
          );
          return;
        }
        setResult({ path: requestPath, data: value });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setResult({
            path: requestPath,
            error:
              failure instanceof Error
                ? failure.message
                : "Não foi possível carregar os leilões.",
          });
      });
    return () => controller.abort();
  }, [page, query, request, requestPath, retry]);
  useEffect(() => {
    restoreNavigation(Boolean(data || error));
  }, [data, error]);
  function updateFilter(name: string, value: string) {
    const next = new URLSearchParams(query);
    if (value) next.set(name, value);
    else next.delete(name);
    navigate(listHref(1, next.toString()), { preserveScroll: true });
  }
  const returnTo = params.get("regresso");
  const listUrl = listHref(page, query);
  const detailSearch =
    listUrl === listPath
      ? ""
      : `?${new URLSearchParams({ regresso: listUrl })}`;
  return (
    <section
      className="producer-auctions"
      data-navigation-ready={Boolean(data || error)}
    >
      {id ? (
        <Button
          className="producer-products__back"
          href={returnTo?.startsWith(`${listPath}?`) ? returnTo : listPath}
          variant="cream"
          icon={faArrowLeft}
        >
          Voltar aos meus leilões
        </Button>
      ) : (
        <div className="producer-auctions__filters">
          <fieldset className="producer-auctions__states">
            <legend>Estado</legend>
            <div className="producer-auctions__state-options">
              {stateFilters.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={state === value ? "dark" : "cream"}
                  className="producer-auctions__filter-button"
                  aria-pressed={state === value}
                  data-navigation-id={`auction-state-${value}`}
                  onClick={() => updateFilter("estado", value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </fieldset>
          <label className="producer-auctions__visibility-filter">
            <input
              type="checkbox"
              checked={unavailable}
              data-navigation-id="auction-visibility"
              onChange={(event) =>
                updateFilter(
                  "visibilidade",
                  event.target.checked ? "indisponivel" : "",
                )
              }
            />
            Indisponíveis publicamente
          </label>
        </div>
      )}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button
            onClick={() => {
              setResult(undefined);
              setRetry((value) => value + 1);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : !data ? (
        <LoadingPlaceholder label="A carregar leilões…" />
      ) : "items" in data ? (
        <>
          <p className="producer-auctions__count" role="status">
            {data.total} {data.total === 1 ? "leilão" : "leilões"}
            {data.total > data.limit && (
              <>
                {" "}
                · Página {data.page} de {Math.ceil(data.total / data.limit)}
              </>
            )}
          </p>
          {!data.items.length && (
            <p className="producer-products__panel">
              {query
                ? "Nenhum leilão corresponde aos filtros selecionados."
                : "Ainda não tem leilões. Crie o seu primeiro leilão com produtos publicados e stock disponível."}
            </p>
          )}
          {data.items.length > 0 && (
            <ul className="producer-auctions__list">
              {data.items.map((auction) => (
                <li className="producer-auctions__card" key={auction._id}>
                  <AuctionSummary
                    auction={auction}
                    href={`${listPath}/${auction._id}${detailSearch}`}
                  />
                </li>
              ))}
            </ul>
          )}
          {data.total > data.limit && (
            <nav
              className="producer-products__actions"
              aria-label="Paginação de leilões"
            >
              <Button
                variant="cream"
                disabled={page <= 1}
                onClick={() => navigate(listHref(page - 1, query))}
              >
                Anterior
              </Button>
              <Button
                variant="cream"
                disabled={page * data.limit >= data.total}
                onClick={() => navigate(listHref(page + 1, query))}
              >
                Seguinte
              </Button>
            </nav>
          )}
        </>
      ) : (
        <div className="producer-auctions__detail">
          <div className="producer-auctions__card producer-auctions__card--detail">
            {params.has("criado") && <p role="status">Leilão criado.</p>}
            <AuctionSummary auction={data} />
            {data.motivoCancelamento && (
              <p className="producer-auctions__reason">
                <strong>Motivo do cancelamento</strong>
                {cancellationMessages[data.motivoCancelamento]}
              </p>
            )}
          </div>
          <ProducerAuctionHistory key={data._id} id={data._id} />
        </div>
      )}
    </section>
  );
}
