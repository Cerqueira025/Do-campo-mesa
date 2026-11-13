import { useEffect, useId, useState } from "react";
import Button from "../../components/ui/Button";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import { useAuth } from "../auth/useAuth";
import { priceFormatter } from "../products/product";
import type { AuctionBid } from "./auction";

interface BidPage {
  items: Pick<AuctionBid, "_id" | "valor" | "createdAt" | "nome">[];
  page: number;
  limit: number;
  total: number;
}

const dateTime = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export default function ProducerAuctionHistory({ id }: { id: string }) {
  const { request } = useAuth();
  const heading = useId();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: BidPage;
    error?: string;
  }>();
  const key = `${page}:${retry}`;
  const pending = result?.key !== key;
  const { data, error } = result ?? {};
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  useEffect(() => {
    const controller = new AbortController();
    void request<BidPage>(`/auctions/mine/${id}/bids?page=${page}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        const last = Math.max(1, Math.ceil(data.total / data.limit));
        if (page > last) setPage(last);
        else setResult({ key, data });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            key,
            data: previous?.data,
            error:
              failure instanceof Error
                ? failure.message
                : "Não foi possível carregar as licitações.",
          }));
      });
    return () => controller.abort();
  }, [id, key, page, request]);

  return (
    <section className="producer-auctions__card" aria-labelledby={heading}>
      <div className="producer-auctions__history-heading">
        <div>
          <h2 className="producer-auctions__title" id={heading}>
            Histórico de licitações
          </h2>
          <p>Da mais recente para a mais antiga.</p>
        </div>
        {data && (
          <span>
            {data.total} {data.total === 1 ? "licitação" : "licitações"}
          </span>
        )}
      </div>
      {pending ? (
        <LoadingPlaceholder label="A carregar licitações…" />
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <Button
            variant="cream"
            onClick={() => setRetry((value) => value + 1)}
          >
            Tentar novamente
          </Button>
        </div>
      ) : data?.items.length ? (
        <table className="producer-auctions__bids" aria-labelledby={heading}>
          <thead>
            <tr>
              <th scope="col">Data e hora</th>
              <th scope="col">Licitador</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((bid) => (
              <tr key={bid._id}>
                <td>
                  <time dateTime={bid.createdAt}>
                    {dateTime.format(new Date(bid.createdAt))}
                  </time>
                </td>
                <td>{bid.nome}</td>
                <td>{priceFormatter.format(bid.valor / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="producer-auctions__bids-empty">
          Ainda não há licitações para este leilão.
        </p>
      )}
      {lastPage > 1 && (
        <nav
          className="producer-auctions__history-pages"
          aria-label="Paginação das licitações"
        >
          <span role="status">
            Página {data?.page} de {lastPage}
          </span>
          <div className="producer-products__actions">
            <Button
              variant="cream"
              disabled={pending || page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="cream"
              disabled={pending || page >= lastPage}
              onClick={() => setPage(page + 1)}
            >
              Seguinte
            </Button>
          </div>
        </nav>
      )}
    </section>
  );
}
