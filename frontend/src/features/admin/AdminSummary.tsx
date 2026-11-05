import type { ReactNode } from "react";
import Button from "../../components/ui/Button";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import InternalLink from "../../navigation/InternalLink";
import OrderStatus from "../orders/OrderStatus";
import { orderStates } from "../orders/order";
import type { AdminSummary as SummaryData } from "./admin";
import { useAdminData } from "./useAdminData";

function Metric({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="admin-page__panel admin-page__metric">
      <h3>{title}</h3>
      <p className="admin-page__count">{count}</p>
      {children}
    </section>
  );
}

function Distribution({
  title,
  counts,
  items,
  base,
}: {
  title: string;
  counts: Record<string, number>;
  items: [string, ReactNode][];
  base: string;
}) {
  return (
    <section className="admin-page__panel">
      <h2>{title}</h2>
      <ul className="admin-page__distribution">
        {items.map(([key, label]) => (
          <li key={key}>
            <InternalLink href={`${base}${key}`}>
              <span>{label}</span>{" "}
              <strong>
                {counts[key] ?? 0}
                <span aria-hidden="true"> →</span>
              </strong>
            </InternalLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminSummary() {
  const { data, error, refresh } = useAdminData<SummaryData>(
    "/admin/summary",
    true,
  );
  return (
    <>
      {error && (
        <div role="alert" className="admin-page__error">
          <p>
            {error}
            {data && " A mostrar os dados anteriores."}
          </p>
          <Button variant="cream" onClick={refresh}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!data && !error && <LoadingPlaceholder label="A carregar resumo…" />}
      {data && (
        <div className="admin-page__summary">
          <section aria-labelledby="admin-pending-title">
            <div className="admin-page__section-heading">
              <h2 id="admin-pending-title">Ações pendentes</h2>
              <span>Aprovação e moderação</span>
            </div>
            <div className="admin-page__tasks">
              <Metric
                title="Produtores pendentes"
                count={data.pendingProducers}
              >
                <p>
                  {data.pendingProducers
                    ? "Pedidos de registo à espera de aprovação."
                    : "Sem pedidos pendentes"}
                </p>
                {data.pendingProducers ? (
                  <Button href="/admin/produtores">Rever pedidos</Button>
                ) : (
                  <InternalLink href="/admin/produtores">
                    Consultar pedidos →
                  </InternalLink>
                )}
              </Metric>
              <Metric
                title="Avaliações denunciadas"
                count={data.reportedReviews}
              >
                <p>
                  {data.reportedReviews
                    ? "Avaliações que precisam de revisão."
                    : "Sem avaliações por rever"}
                </p>
                {data.reportedReviews ? (
                  <Button href="/admin/avaliacoes?estado=denunciada">
                    Rever avaliações
                  </Button>
                ) : (
                  <InternalLink href="/admin/avaliacoes?estado=denunciada">
                    Consultar avaliações →
                  </InternalLink>
                )}
              </Metric>
            </div>
          </section>
          <section aria-labelledby="admin-overview-title">
            <div className="admin-page__section-heading">
              <h2 id="admin-overview-title">Visão geral</h2>
              <span>Totais da plataforma</span>
            </div>
            <div className="admin-page__metrics">
              <Metric
                title="Utilizadores"
                count={Object.values(data.users).reduce(
                  (sum, count) => sum + count,
                  0,
                )}
              >
                <InternalLink href="/admin/utilizadores">
                  Ver utilizadores →
                </InternalLink>
              </Metric>
              <Metric
                title="Encomendas"
                count={Object.values(data.orders).reduce(
                  (sum, count) => sum + count,
                  0,
                )}
              >
                <InternalLink href="/admin/encomendas">
                  Ver encomendas →
                </InternalLink>
              </Metric>
              <Metric title="Leilões ativos" count={data.activeAuctions}>
                <InternalLink href="/admin/leiloes">Ver leilões →</InternalLink>
              </Metric>
            </div>
          </section>
          <div className="admin-page__distributions">
            <Distribution
              title="Utilizadores por papel"
              counts={data.users}
              items={[
                ["comprador", "Compradores"],
                ["produtor", "Produtores"],
                ["administrador", "Administradores"],
              ]}
              base="/admin/utilizadores?papel="
            />
            <Distribution
              title="Encomendas por estado"
              counts={data.orders}
              items={orderStates.map((state) => [
                state,
                <OrderStatus state={state} />,
              ])}
              base="/admin/encomendas?estado="
            />
          </div>
        </div>
      )}
    </>
  );
}
