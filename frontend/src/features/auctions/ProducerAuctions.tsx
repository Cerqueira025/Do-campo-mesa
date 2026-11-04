import "../products/ProducerProducts.scss";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import Button from "../../components/ui/Button";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import { navigate, restoreNavigation } from "../../navigation/navigation";
import { producerPage } from "../products/management";
import { priceFormatter } from "../products/product";
import { cancellationMessages, type Auction } from "./auction";
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

function AuctionSummary({ auction }: { auction: ProducerAuction }) {
  return (
    <>
      <div className="producer-auctions__card-heading">
        <h2 className="producer-auctions__title">{auction.lote}</h2>
        <span
          className={`producer-auctions__status producer-auctions__status--${auction.estado}`}
        >
          <span aria-hidden="true" className="producer-auctions__status-dot" />
          {labels[auction.estado]}
        </span>
      </div>
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
      <dl className="producer-auctions__metrics">
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
        <div className="producer-auctions__value">
          <dt>Valor atual</dt>
          <dd>{priceFormatter.format(auction.licitacaoAtual.valor / 100)}</dd>
        </div>
      </dl>
    </>
  );
}

export default function ProducerAuctions({ id }: { id?: string }) {
  const { request } = useAuth();
  const page = producerPage(window.location.search);
  const [data, setData] = useState<AuctionPage | ProducerAuction>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void request<AuctionPage | ProducerAuction>(
      id ? `/auctions/mine/${id}` : `/auctions/mine?page=${page}&limit=24`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (controller.signal.aborted) return;
        if (
          "items" in value &&
          page > Math.max(1, Math.ceil(value.total / value.limit))
        ) {
          navigate(
            `/produtor/leiloes?page=${Math.max(1, Math.ceil(value.total / value.limit))}`,
            { replace: true },
          );
          return;
        }
        setData(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Não foi possível carregar os leilões.",
          );
      });
    return () => controller.abort();
  }, [id, page, request, retry]);
  useEffect(() => {
    restoreNavigation(Boolean(data || error));
  }, [data, error]);
  return (
    <section
      className="producer-auctions"
      data-navigation-ready={Boolean(data || error)}
    >
      <Button
        className="producer-products__back"
        href={id ? "/produtor/leiloes" : "/produtor/leiloes/novo"}
        variant={id ? "cream" : "primary"}
      >
        {id ? "Voltar aos meus leilões" : "Novo leilão"}
      </Button>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button
            onClick={() => {
              setError("");
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
          <p className="producer-auctions__count">
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
              Ainda não tem leilões. Crie o seu primeiro leilão com produtos
              publicados e stock disponível.
            </p>
          )}
          <ul className="producer-auctions__list">
            {data.items.map((auction) => (
              <li className="producer-auctions__card" key={auction._id}>
                <AuctionSummary auction={auction} />
                <div className="producer-auctions__footer">
                  <Button
                    href={`/produtor/leiloes/${auction._id}`}
                    variant="cream"
                  >
                    Consultar leilão{" "}
                    <span className="producer-products__sr-only">
                      {auction.lote}
                    </span>
                    <span
                      className="producer-auctions__arrow"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {data.total > data.limit && (
            <nav
              className="producer-products__actions"
              aria-label="Paginação de leilões"
            >
              <Button
                variant="cream"
                disabled={page <= 1}
                onClick={() => navigate(`/produtor/leiloes?page=${page - 1}`)}
              >
                Anterior
              </Button>
              <Button
                variant="cream"
                disabled={page * data.limit >= data.total}
                onClick={() => navigate(`/produtor/leiloes?page=${page + 1}`)}
              >
                Seguinte
              </Button>
            </nav>
          )}
        </>
      ) : (
        <div className="producer-auctions__card">
          {new URLSearchParams(window.location.search).has("criado") && (
            <p role="status">Leilão criado.</p>
          )}
          <AuctionSummary auction={data} />
          <dl className="producer-products__facts">
            <div>
              <dt>Preço base</dt>
              <dd>{priceFormatter.format(data.precoBase / 100)}</dd>
            </div>
            <div>
              <dt>Incremento mínimo</dt>
              <dd>{priceFormatter.format(data.incremento / 100)}</dd>
            </div>
          </dl>
          {data.motivoCancelamento && (
            <p>{cancellationMessages[data.motivoCancelamento]}</p>
          )}
        </div>
      )}
    </section>
  );
}
