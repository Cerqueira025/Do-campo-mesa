import {
  faBoxOpen,
  faCheckDouble,
  faCircleCheck,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { OrderState } from "./order";
import "./OrderStatus.scss";

const states = {
  pendente: { label: "Pendente", icon: faClock },
  confirmada: { label: "Confirmada", icon: faCircleCheck },
  pronta: { label: "Pronta", icon: faBoxOpen },
  entregue: { label: "Entregue", icon: faCheckDouble },
};

export default function OrderStatus({ state }: { state: OrderState }) {
  const { label, icon } = states[state];
  return (
    <span className={`order-status order-status--${state}`}>
      <FontAwesomeIcon icon={icon} aria-hidden="true" />
      {label}
    </span>
  );
}
