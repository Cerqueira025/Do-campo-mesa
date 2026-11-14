import { useState } from "react";
import Button from "../../components/ui/Button";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import { useAuth } from "../auth/useAuth";
import { priceFormatter } from "../products/product";
import OrderLayout from "./OrderLayout";
import type { Order } from "./order";
import ProducerOrderRow from "./ProducerOrderRow";
import ProducerLowStock from "./ProducerLowStock";
import ProducerSalesChart from "./ProducerSalesChart";
import { producerSales, salesPeriods, type SalesPeriod } from "./producerSales";
import { useOrderPolling } from "./useOrderPolling";
import "./ProducerSummary.scss";

export default function ProducerSummary({ embedded }: { embedded: boolean }) {
  const { utilizador } = useAuth();
  const [period, setPeriod] = useState<SalesPeriod>("halfYear");
  const { data, error, refresh } = useOrderPolling<Order[]>("/orders");
  const sales =
    data && utilizador
      ? producerSales(data, utilizador.id, new Date(), period)
      : null;
  const showStock = utilizador?.validacao === "aceite";

  return (
    <OrderLayout title="Resumo" embedded={embedded}>
      {error && (
        <div role="alert" className="order-page__error">
          <p>{error}</p>
          <Button onClick={refresh}>Tentar novamente</Button>
        </div>
      )}
      {!data && !error && <LoadingPlaceholder label="A carregar vendas…" />}
      <div className="producer-summary">
        {sales && (
          <section className="producer-summary__panel">
            <div className="producer-summary__heading">
              <h2>Evolução das vendas</h2>
              <div
                className="producer-summary__periods"
                role="group"
                aria-label="Período das vendas"
              >
                {(Object.keys(salesPeriods) as SalesPeriod[]).map((option) => (
                  <Button
                    key={option}
                    variant={period === option ? "primary" : "cream"}
                    aria-pressed={period === option}
                    onClick={() => setPeriod(option)}
                  >
                    {salesPeriods[option]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="producer-summary__overview">
              <div className="producer-summary__metric">
                <h2>Vendas do mês</h2>
                <p>
                  <strong className="producer-summary__total">
                    {priceFormatter.format(sales.currentTotal / 100)}
                  </strong>
                </p>
                <p>
                  {sales.change === null
                    ? "Sem vendas no mês anterior"
                    : `${sales.change > 0 ? "+" : ""}${sales.change}% face a ${sales.previousMonth}`}
                </p>
                <p>Conta encomendas entregues no mês.</p>
              </div>
              <ProducerSalesChart key={period} series={sales.series} />
            </div>
          </section>
        )}
        {(sales || showStock) && (
          <div className="producer-summary__insights">
            {sales && (
              <section className="producer-summary__panel">
                <h2>Produtos mais vendidos</h2>
                <p>Por valor vendido · {salesPeriods[period]}</p>
                {sales.ranking.length === 0 ? (
                  <p>Sem vendas por produto neste período.</p>
                ) : (
                  <ol className="producer-summary__ranking">
                    {sales.ranking.map((product) => (
                      <li key={product.id}>
                        <div className="producer-summary__rank">
                          <strong>{product.name}</strong>
                          <span>
                            {priceFormatter.format(product.total / 100)}
                          </span>
                        </div>
                        <div
                          className="producer-summary__track"
                          aria-hidden="true"
                        >
                          <div
                            style={{
                              width: `${(product.total / sales.ranking[0].total) * 100}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {sales.hasMixedLots && (
                  <p>
                    O valor dos lotes com vários produtos aparece apenas no
                    gráfico.
                  </p>
                )}
              </section>
            )}
            {showStock && <ProducerLowStock key={utilizador.id} />}
          </div>
        )}
        {sales && (
          <section className="producer-summary__panel">
            <div className="producer-summary__heading">
              <h2>Encomendas recentes</h2>
              <Button href="/produtor/encomendas" variant="cream">
                Ver todas
              </Button>
            </div>
            {sales.recent.length === 0 ? (
              <p>Ainda não há encomendas.</p>
            ) : (
              <ul className="producer-summary__list">
                {sales.recent.map((order) => (
                  <li className="producer-summary__recent" key={order._id}>
                    <ProducerOrderRow order={order} heading="h3" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </OrderLayout>
  );
}
