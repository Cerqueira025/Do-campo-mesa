import { useRef, useState, type FormEvent } from "react";
import Button from "../components/ui/Button";
import LoadingPlaceholder from "../components/ui/LoadingPlaceholder";
import FormField from "../components/ui/input/FormField";
import { ApiError } from "../api/client";
import { useAuth } from "../features/auth/useAuth";
import OrderLayout from "../features/orders/OrderLayout";
import OrderReviews from "../features/orders/OrderReviews";
import { orderDate, orderStates, type Order } from "../features/orders/order";
import { useOrderPolling } from "../features/orders/useOrderPolling";
import { priceFormatter } from "../features/products/product";
import InternalLink from "../navigation/InternalLink";

export default function OrderDetailPage({
  id,
  embedded = false,
  backUrl,
}: {
  id: string | null;
  embedded?: boolean;
  backUrl?: string;
}) {
  if (embedded && id) return <OrderDetail key={id} id={id} backUrl={backUrl} />;
  return id ? (
    <OrderLayout title="Detalhe da encomenda">
      <OrderDetail key={id} id={id} />
    </OrderLayout>
  ) : (
    <OrderLayout title="Encomenda não encontrada">
      <p>Esta encomenda não existe ou não está acessível.</p>
      <Button href="/conta">Voltar à conta</Button>
    </OrderLayout>
  );
}
function OrderDetail({ id, backUrl }: { id: string; backUrl?: string }) {
  const {
    data: order,
    error,
    refresh,
  } = useOrderPolling<Order>(`/orders/${id}`);
  const { utilizador, request } = useAuth();
  const [mutationError, setMutationError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"levantamento" | "entrega">(
    "levantamento",
  );
  const [address, setAddress] = useState("");
  const pending = useRef(false);
  const producer =
    utilizador?.papel === "produtor" &&
    order?.produtorId?._id === utilizador.id;
  const buyer =
    utilizador?.papel === "comprador" &&
    order?.compradorId?._id === utilizador.id;
  const admin = utilizador?.papel === "administrador";
  const next = order
    ? orderStates[orderStates.indexOf(order.estado) + 1]
    : undefined;
  async function advance() {
    if (pending.current || !next || !producer) return;
    pending.current = true;
    setBusy(true);
    setMutationError("");
    setMessage("");
    try {
      await request(`/orders/${id}/estado`, {
        method: "PATCH",
        body: { estado: next },
      });
      setMessage(`Encomenda marcada como ${next}.`);
    } catch (failure) {
      setMutationError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível atualizar o estado.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
      refresh();
    }
  }
  async function chooseDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !buyer || !order?.leilaoId || order.entrega) return;
    if (deliveryType === "entrega" && !address.trim()) {
      setMutationError("Indique a morada de entrega.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setMutationError("");
    setMessage("");
    try {
      await request(`/orders/${id}/entrega`, {
        method: "PATCH",
        body: {
          entrega: {
            tipo: deliveryType,
            ...(deliveryType === "entrega" ? { morada: address.trim() } : {}),
          },
        },
      });
      setMessage("Modalidade confirmada. O produtor já pode preparar o lote.");
    } catch (failure) {
      setMutationError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível guardar a modalidade.",
      );
      if (failure instanceof ApiError && failure.status === 409) refresh();
    } finally {
      pending.current = false;
      setBusy(false);
      refresh();
    }
  }
  return (
    <>
      <Button
        href={
          backUrl ||
          (admin
            ? "/admin/encomendas"
            : utilizador?.papel === "produtor"
              ? "/produtor/encomendas"
              : "/encomendas")
        }
        variant="cream"
      >
        Voltar às encomendas
      </Button>
      {error && (
        <div role="alert" className="order-page__error">
          <p>{error}</p>
          <Button onClick={refresh}>Tentar novamente</Button>
        </div>
      )}
      {!order && !error && <LoadingPlaceholder label="A carregar encomenda…" />}
      {order && (
        <>
          <section className="order-page__panel">
            <h2>Encomenda {order._id}</h2>
            <dl className="order-page__facts">
              <div>
                <dt>Produtor</dt>
                <dd>{order.produtorId?.nome || "Indisponível"}</dd>
              </div>
              <div>
                <dt>Comprador</dt>
                <dd>{order.compradorId?.nome || "Indisponível"}</dd>
              </div>
              <div>
                <dt>Criada em</dt>
                <dd>{orderDate(order.createdAt)}</dd>
              </div>
              {order.dataEntrega && (
                <div>
                  <dt>Entregue em</dt>
                  <dd>{orderDate(order.dataEntrega)}</dd>
                </div>
              )}
              {order.entrega?.dataPrevista && (
                <div>
                  <dt>Data prevista</dt>
                  <dd>{orderDate(order.entrega.dataPrevista)}</dd>
                </div>
              )}
            </dl>
            {order.leilaoId && (
              <p>
                Encomenda do{" "}
                <InternalLink
                  className="order-page__link"
                  href={`${admin ? "/admin/leiloes" : "/leiloes"}/${order.leilaoId}`}
                >
                  leilão {order.leilaoId}
                </InternalLink>
                .
              </p>
            )}
            <h3>Estado: {order.estado}</h3>
            <ol
              className="order-page__timeline"
              aria-label="Progressão da encomenda"
            >
              {orderStates.map((state) => (
                <li
                  key={state}
                  aria-current={state === order.estado ? "step" : undefined}
                >
                  {state}
                  {orderStates.indexOf(state) <
                  orderStates.indexOf(order.estado)
                    ? " · concluída"
                    : ""}
                </li>
              ))}
            </ol>
            <p role="status">{message}</p>
            {mutationError && (
              <p role="alert" className="order-page__error">
                {mutationError}
              </p>
            )}
            {producer && order.leilaoId && !order.entrega && (
              <p>
                O vencedor ainda não escolheu a modalidade. Aguarde essa
                confirmação para preparar o lote.
              </p>
            )}
            {producer && next && (!order.leilaoId || order.entrega) && (
              <Button disabled={busy} onClick={() => void advance()}>
                {busy ? "A atualizar…" : `Marcar como ${next}`}
              </Button>
            )}
          </section>
          <section className="order-page__panel">
            <h2>Produtos</h2>
            <ul className="order-page__list">
              {order.linhas.map((line) => (
                <li key={line.produtoId}>
                  <h3>{line.nome}</h3>
                  <p>
                    {line.quantidade} {line.unidade}
                    {!order.leilaoId && line.precoUnitario !== undefined && (
                      <>
                        {" "}
                        × {priceFormatter.format(
                          line.precoUnitario / 100,
                        )} ={" "}
                        <strong>
                          {priceFormatter.format(
                            Math.round(line.precoUnitario * line.quantidade) /
                              100,
                          )}
                        </strong>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
            <h3>
              {order.leilaoId ? "Preço do lote" : "Total"}:{" "}
              {priceFormatter.format(order.total / 100)}
            </h3>
          </section>
          {order.entrega ? (
            <section className="order-page__panel">
              <h2>
                {order.entrega.tipo === "entrega" ? "Entrega" : "Levantamento"}
              </h2>
              <p>
                {order.entrega.tipo === "entrega"
                  ? order.entrega.morada
                  : order.entrega.morada || "Levantamento junto do produtor."}
              </p>
            </section>
          ) : order.leilaoId && buyer ? (
            <section className="order-page__panel">
              <h2>Escolher como receber o lote</h2>
              <form
                className="order-page__form"
                onSubmit={(event) => void chooseDelivery(event)}
              >
                <FormField id="auction-delivery-type" label="Modalidade">
                  <select
                    id="auction-delivery-type"
                    value={deliveryType}
                    disabled={busy}
                    onChange={(event) =>
                      setDeliveryType(event.target.value as typeof deliveryType)
                    }
                  >
                    <option value="levantamento">
                      Levantamento junto do produtor
                    </option>
                    <option value="entrega">Entrega na morada indicada</option>
                  </select>
                </FormField>
                {deliveryType === "entrega" && (
                  <FormField
                    id="auction-delivery-address"
                    label="Morada de entrega"
                  >
                    <textarea
                      id="auction-delivery-address"
                      required
                      value={address}
                      disabled={busy}
                      onChange={(event) => setAddress(event.target.value)}
                    />
                  </FormField>
                )}
                <Button type="submit" disabled={busy}>
                  {busy ? "A confirmar…" : "Confirmar modalidade"}
                </Button>
              </form>
            </section>
          ) : null}
          {order.estado === "entregue" &&
            utilizador?.papel === "comprador" &&
            order.compradorId?._id === utilizador.id && (
              <OrderReviews order={order} />
            )}
        </>
      )}
    </>
  );
}
