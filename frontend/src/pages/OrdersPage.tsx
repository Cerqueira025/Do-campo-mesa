import { useState } from "react";
import Button from "../components/ui/Button";
import LoadingPlaceholder from "../components/ui/LoadingPlaceholder";
import FormField from "../components/ui/input/FormField";
import Select from "../components/ui/input/Select";
import InternalLink from "../navigation/InternalLink";
import { useCart } from "../features/cart/cartContext";
import OrderLayout from "../features/orders/OrderLayout";
import OrderStatus from "../features/orders/OrderStatus";
import ProducerOrderRow from "../features/orders/ProducerOrderRow";
import { orderDate, orderStates, type Order } from "../features/orders/order";
import { useOrderPolling } from "../features/orders/useOrderPolling";
import { priceFormatter } from "../features/products/product";

export default function OrdersPage({
  producer = false,
  embedded = false,
}: {
  producer?: boolean;
  embedded?: boolean;
}) {
  const { data, error, refresh } = useOrderPolling<Order[]>("/orders");
  const [filter, setFilter] = useState("");
  const { confirmadas } = useCart();
  const orders = data?.filter((order) => !filter || order.estado === filter);
  return (
    <OrderLayout
      embedded={embedded}
      title={producer ? "Encomendas recebidas" : "As minhas encomendas"}
    >
      {!producer && confirmadas.length > 0 && (
        <section className="order-page__panel" role="status">
          <h2>Compra confirmada</h2>
          <p>As suas encomendas foram criadas:</p>
          <ul>
            {confirmadas.map((id) => (
              <li key={id}>
                <InternalLink
                  className="order-page__link"
                  href={`/encomendas/${id}`}
                >
                  {id}
                </InternalLink>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="order-page__form">
        <FormField
          id="order-filter"
          label="Filtrar por estado"
          unframed
          compact={false}
        >
          <Select
            id="order-filter"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "", label: "Todos os estados" },
              ...orderStates.map((state) => ({ value: state, label: state })),
            ]}
          />
        </FormField>
      </div>
      {error && (
        <div role="alert" className="order-page__error">
          <p>{error}</p>
          <Button onClick={refresh}>Tentar novamente</Button>
        </div>
      )}
      {!data && !error && <LoadingPlaceholder label="A carregar encomendas…" />}
      {orders?.length === 0 && (
        <div className="order-page__panel">
          <p>
            {filter
              ? "Não há encomendas neste estado."
              : "Ainda não há encomendas."}
          </p>
          {!producer && <Button href="/">Explorar produtos</Button>}
        </div>
      )}
      <ul className="order-page__list">
        {orders?.map((order) => producer ? (
          <li className="order-page__panel" key={order._id}>
            <ProducerOrderRow order={order} heading="h2" />
            {order.leilaoId && !order.entrega && (
              <p>A aguardar a modalidade do vencedor.</p>
            )}
          </li>
        ) : (
          <li className="order-page__panel" key={order._id}>
            <h2>
              <InternalLink
                className="order-page__link"
                href={`/encomendas/${order._id}`}
              >
                Encomenda {order._id}
              </InternalLink>
            </h2>
            <p>
              {order.produtorId?.nome || "Produtor indisponível"}
            </p>
            {order.leilaoId && !order.entrega && (
              <p>Escolha como receber o lote no detalhe da encomenda.</p>
            )}
            <dl className="order-page__facts">
              <div>
                <dt>Data</dt>
                <dd>{orderDate(order.createdAt)}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <OrderStatus state={order.estado} />
                </dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{priceFormatter.format(order.total / 100)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </OrderLayout>
  );
}
