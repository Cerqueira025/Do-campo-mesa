import { faBasketShopping } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import InternalLink from "../../navigation/InternalLink";
import { priceFormatter } from "../products/product";
import OrderStatus from "./OrderStatus";
import { orderDate, type Order } from "./order";
import "./ProducerOrderRow.scss";

export default function ProducerOrderRow({
  order,
  heading: Heading,
}: {
  order: Order;
  heading: "h2" | "h3";
}) {
  return (
    <div className="producer-order-row">
      <Heading className="producer-order-row__heading">
        <InternalLink
          className="producer-order-row__link order-page__link"
          href={`/encomendas/${order._id}`}
        >
          <span className="producer-order-row__icon" aria-hidden="true">
            <FontAwesomeIcon icon={faBasketShopping} />
          </span>
          <span>Encomenda {order._id}</span>
        </InternalLink>
      </Heading>
      <dl className="producer-order-row__facts">
        <div>
          <dt>Comprador</dt>
          <dd>{order.compradorId?.nome || "Comprador indisponível"}</dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>{orderDate(order.createdAt)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>
            <span className="producer-order-row__total">
              {priceFormatter.format(order.total / 100)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <OrderStatus state={order.estado} />
          </dd>
        </div>
      </dl>
    </div>
  );
}
