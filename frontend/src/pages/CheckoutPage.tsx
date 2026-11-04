import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import Button from "../components/ui/Button";
import CartLink from "../components/ui/CartLink";
import LoadingPlaceholder from "../components/ui/LoadingPlaceholder";
import FormField from "../components/ui/input/FormField";
import Select from "../components/ui/input/Select";
import { useCart } from "../features/cart/cartContext";
import { cartTotal, groupCart, validProduct } from "../features/cart/cart";
import { useAuth } from "../features/auth/useAuth";
import OrderLayout from "../features/orders/OrderLayout";
import type { Order } from "../features/orders/order";
import {
  priceFormatter,
  type ProductDetail,
} from "../features/products/product";
import {
  validPurchaseQuantity,
  quantityRestriction,
} from "../features/products/purchaseQuantity";
import { navigate } from "../navigation/navigation";

export default function CheckoutPage() {
  const { linhas, atualizarProdutos, esvaziar, confirmar } = useCart();
  const { request } = useAuth();
  const [tipo, setTipo] = useState<"levantamento" | "entrega">("levantamento");
  const [morada, setMorada] = useState("");
  const [validation, setValidation] = useState<{
    key: string;
    errors: string[];
    changes: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  const active = useRef(true);
  const snapshot = useRef(linhas);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    snapshot.current = linhas;
  }, [linhas]);
  const key = JSON.stringify(
    linhas.map((line) => [line.produto._id, line.quantidade]),
  );

  useEffect(() => {
    const controller = new AbortController();
    const current = snapshot.current;
    async function validate() {
      const products: ProductDetail[] = [];
      const errors: string[] = [];
      const changes: string[] = [];
      await Promise.all(
        current.map(async (line) => {
          try {
            const product = await api<ProductDetail>(
              `/products/${line.produto._id}`,
              { signal: controller.signal },
            );
            if (!validProduct(product))
              throw new Error("Resposta inválida do produto.");
            products.push(product);
            if (!validPurchaseQuantity(line.quantidade, product.unidade)) {
              errors.push(
                `${product.nome}: ${quantityRestriction(product.unidade)} Corrija a quantidade no carrinho.`,
              );
            }
            if (product.stock < line.quantidade)
              errors.push(
                `${product.nome}: stock disponível ${product.stock} ${product.unidade}. Corrija a quantidade no carrinho.`,
              );
            if (
              product.preco !== line.produto.preco ||
              product.unidade !== line.produto.unidade ||
              product.nome !== line.produto.nome ||
              product.stock !== line.produto.stock
            )
              changes.push(
                `${product.nome}: os dados foram atualizados. Reveja o resumo antes de confirmar.`,
              );
          } catch (failure) {
            if (failure instanceof ApiError && failure.status === 404)
              errors.push(
                `${line.produto.nome}: já não está disponível. Remova o artigo do carrinho.`,
              );
            else
              errors.push(
                `${line.produto.nome}: não foi possível confirmar a disponibilidade. Tente verificar novamente.`,
              );
          }
        }),
      );
      if (!controller.signal.aborted) {
        atualizarProdutos(products);
        setValidation({ key, errors, changes });
      }
    }
    void validate();
    return () => controller.abort();
    // A identidade e a quantidade das linhas determinam a revisão; os preços são atualizados pelo resultado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      submitting.current ||
      !linhas.length ||
      linhas.some(
        (line) =>
          !validPurchaseQuantity(
            line.quantidade,
            line.produto.unidade,
            line.produto.stock,
          ),
      ) ||
      validation?.key !== key ||
      validation.errors.length
    )
      return;
    if (tipo === "entrega" && !morada.trim()) {
      setError("Indique a morada de entrega.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const orders = await request<Order[]>("/orders", {
        method: "POST",
        body: {
          linhas: linhas.map((line) => ({
            produtoId: line.produto._id,
            quantidade: line.quantidade,
          })),
          entrega: {
            tipo,
            ...(tipo === "entrega" ? { morada: morada.trim() } : {}),
          },
        },
      });
      if (!active.current) return;
      if (
        !Array.isArray(orders) ||
        !orders.length ||
        orders.some((order) => !order._id)
      )
        throw new Error(
          "Não foi possível confirmar a resposta do servidor. Consulte as encomendas antes de repetir a compra.",
        );
      confirmar(orders.map((order) => order._id));
      esvaziar();
      navigate("/encomendas", { replace: true });
    } catch (failure) {
      if (!active.current) return;
      const uncertain =
        !(failure instanceof ApiError) ||
        failure.status < 400 ||
        failure.status >= 500;
      setError(
        uncertain
          ? "Não foi possível confirmar o resultado da compra. Consulte as encomendas antes de tentar novamente."
          : failure.message,
      );
      if (failure instanceof ApiError && failure.status === 409) {
        setValidation(null);
        setRetry((value) => value + 1);
      }
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }

  return (
    <OrderLayout title="Finalizar encomenda">
      {!linhas.length ? (
        <div className="order-page__panel">
          <p>O carrinho está vazio.</p>
          <Button href="/">Explorar produtos</Button>
        </div>
      ) : (
        <>
          {validation?.key !== key ? (
            <LoadingPlaceholder label="A confirmar preços e disponibilidade…" />
          ) : (
            <>
              {validation.changes.length > 0 && (
                <div className="order-page__panel" role="status">
                  {validation.changes.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              )}
              {validation.errors.length > 0 && (
                <div
                  className="order-page__panel order-page__error"
                  role="alert"
                >
                  {validation.errors.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                  <Button
                    onClick={() => {
                      setValidation(null);
                      setRetry((value) => value + 1);
                    }}
                  >
                    Verificar novamente
                  </Button>
                </div>
              )}
            </>
          )}
          {groupCart(linhas).map((group) => (
            <section key={group.produtor._id} className="order-page__panel">
              <h2>{group.produtor.nome}</h2>
              <ul>
                {group.linhas.map((line) => (
                  <li key={line.produto._id}>
                    {line.produto.nome} · {line.quantidade}{" "}
                    {line.produto.unidade} ·{" "}
                    {priceFormatter.format(line.produto.preco / 100)}/
                    {line.produto.unidade}
                  </li>
                ))}
              </ul>
              <p>
                Subtotal: {priceFormatter.format(cartTotal(group.linhas) / 100)}
              </p>
            </section>
          ))}
          <section className="order-page__panel">
            <h2>Total: {priceFormatter.format(cartTotal(linhas) / 100)}</h2>
            <form
              className="order-page__form"
              onSubmit={(event) => void submit(event)}
              aria-busy={busy}
            >
              <FormField
                id="delivery-type"
                label="Como pretende receber os produtos?"
                unframed
                compact={false}
              >
                <Select
                  id="delivery-type"
                  value={tipo}
                  disabled={busy}
                  onValueChange={(value) => setTipo(value as typeof tipo)}
                  options={[
                    {
                      value: "levantamento",
                      label: "Levantamento junto de cada produtor",
                    },
                    { value: "entrega", label: "Entrega na morada indicada" },
                  ]}
                />
              </FormField>
              {tipo === "entrega" && (
                <FormField
                  id="delivery-address"
                  label="Morada completa de entrega"
                  autoComplete="street-address"
                  required
                  value={morada}
                  disabled={busy}
                  onChange={(event) => setMorada(event.target.value)}
                />
              )}
              <p>
                A modalidade escolhida aplica-se a todos os produtores. Será
                criada uma encomenda para cada um.
              </p>
              {error && (
                <div role="alert" className="order-page__error">
                  <p>{error}</p>
                  <Button href="/encomendas" variant="cream">
                    Consultar encomendas
                  </Button>
                </div>
              )}
              <div className="order-page__actions">
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    validation?.key !== key ||
                    Boolean(validation?.errors.length)
                  }
                >
                  {busy ? "A criar encomendas…" : "Confirmar encomendas"}
                </Button>
                {!busy && <CartLink label="Editar carrinho" />}
              </div>
            </form>
          </section>
        </>
      )}
    </OrderLayout>
  );
}
