import OrderStatus from "../orders/OrderStatus";
import { orderStates } from "../orders/order";

export default function AdminOrderStatus({ value }: { value?: string }) {
  const state = orderStates.find((state) => state === value);
  return state ? <OrderStatus state={state} /> : <span>{value || "—"}</span>;
}
