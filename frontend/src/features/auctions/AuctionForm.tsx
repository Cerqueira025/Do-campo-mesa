import { useEffect, useRef, useState, type FormEvent } from "react";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/input/FormField";
import Select from "../../components/ui/input/Select";
import QuantityInput from "../../components/ui/input/QuantityInput";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import { useAuth } from "../auth/useAuth";
import type { ProducerProduct, ProductPage } from "../products/management";
import { initialPurchaseQuantity } from "../products/purchaseQuantity";
import { navigate, restoreNavigation } from "../../navigation/navigation";
import { auctionHref } from "./auction";
import {
  auctionPayload,
  eligibleAuctionProducts,
  type AuctionDraft,
} from "./creation";
import "./AuctionForm.scss";

export default function AuctionForm() {
  const { request } = useAuth();
  const [products, setProducts] = useState<ProducerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alert = useRef<HTMLParagraphElement>(null);
  const nextKey = useRef(1);
  const focusLine = useRef<number | null>(null);
  const [draft, setDraft] = useState<AuctionDraft>({
    produtos: [{ key: 0, produtoId: "", quantidade: "" }],
    lote: "",
    precoBase: "",
    incremento: "",
    inicio: "agora",
    dataInicio: "",
    dataFim: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const all: ProducerProduct[] = [];
      for (let page = 1; ; page++) {
        const result = await request<ProductPage>(
          `/products/mine?page=${page}&limit=100`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        all.push(...result.items);
        if (page * 100 >= result.total) break;
      }
      setProducts(eligibleAuctionProducts(all));
      setLoaded(true);
      setLoading(false);
    }
    void load().catch((failure) => {
      if (controller.signal.aborted) return;
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível carregar os produtos.",
      );
      setLoading(false);
    });
    return () => controller.abort();
  }, [request, retry]);
  useEffect(() => {
    restoreNavigation(!loading);
  }, [loading]);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error, busy]);
  useEffect(() => {
    if (focusLine.current === null) return;
    document.getElementById(`auction-product-${focusLine.current}`)?.focus();
    focusLine.current = null;
  }, [draft.produtos]);

  function change<K extends keyof AuctionDraft>(
    key: K,
    value: AuctionDraft[K],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  function selectProduct(key: number, produtoId: string) {
    const product = products.find((p) => p._id === produtoId);
    change(
      "produtos",
      draft.produtos.map((line) =>
        line.key === key
          ? {
              ...line,
              produtoId,
              quantidade: product
                ? String(
                    initialPurchaseQuantity(product.unidade, product.stock),
                  )
                : "",
            }
          : line,
      ),
    );
  }
  function addLine() {
    const key = nextKey.current++;
    focusLine.current = key;
    change("produtos", [
      ...draft.produtos,
      { key, produtoId: "", quantidade: "" },
    ]);
  }
  function removeLine(key: number) {
    const index = draft.produtos.findIndex((line) => line.key === key);
    const remaining = draft.produtos.filter((line) => line.key !== key);
    focusLine.current =
      remaining[Math.min(index, remaining.length - 1)]?.key ?? null;
    change("produtos", remaining);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !loaded || !products.length) return;
    setError("");
    try {
      const body = auctionPayload(draft, products);
      pending.current = true;
      setBusy(true);
      const auction = await request<{ _id: string }>("/auctions", {
        method: "POST",
        body,
      });
      navigate(auctionHref(auction._id));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível criar o leilão.",
      );
      alert.current?.focus();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className="producer-products__panel auction-form"
      data-navigation-ready={!loading}
    >
      <h1>Novo leilão</h1>
      <p>
        Escolha um ou vários dos seus produtos. O preço base e as licitações são
        pelo lote completo.
      </p>
      {error && (
        <p
          className="producer-products__error"
          role="alert"
          ref={alert}
          tabIndex={-1}
        >
          {error}
        </p>
      )}
      {loading ? (
        <LoadingPlaceholder label="A carregar produtos…" />
      ) : !loaded ? (
        <Button
          onClick={() => {
            setError("");
            setLoading(true);
            setRetry((value) => value + 1);
          }}
        >
          Tentar novamente
        </Button>
      ) : !products.length ? (
        <p>
          Não tem produtos elegíveis. Publique um produto desbloqueado com stock
          disponível para criar um leilão.
        </p>
      ) : (
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <fieldset className="producer-products__fields" disabled={busy}>
            <legend>Dados do leilão</legend>
            <FormField id="auction-lot" label="Descrição do lote">
              <textarea
                id="auction-lot"
                required
                rows={3}
                value={draft.lote}
                onChange={(event) => change("lote", event.target.value)}
              />
            </FormField>
            <fieldset className="auction-form__products">
              <legend>Produtos do lote</legend>
              {draft.produtos.map((line, index) => {
                const product = products.find((p) => p._id === line.produtoId);
                return (
                  <fieldset key={line.key} className="auction-form__line">
                    <legend>Produto {index + 1}</legend>
                    <FormField
                      id={`auction-product-${line.key}`}
                      label={`Produto ${index + 1}`}
                      unframed
                      compact={false}
                    >
                      <Select
                        id={`auction-product-${line.key}`}
                        required
                        value={line.produtoId}
                        onValueChange={(value) =>
                          selectProduct(line.key, value)
                        }
                        options={[
                          { value: "", label: "Selecione um produto" },
                          ...products
                            .filter(
                              (p) =>
                                p._id === line.produtoId ||
                                !draft.produtos.some(
                                  (other) => other.produtoId === p._id,
                                ),
                            )
                            .map((p) => ({ value: p._id, label: p.nome })),
                        ]}
                      />
                    </FormField>
                    {product && (
                      <FormField
                        id={`auction-quantity-${line.key}`}
                        label={`Quantidade de ${product.nome} (${product.unidade})`}
                        unframed
                        hint={`Stock disponível: ${product.stock.toLocaleString("pt-PT")} ${product.unidade}.`}
                      >
                        <QuantityInput
                          key={product._id}
                          id={`auction-quantity-${line.key}`}
                          value={line.quantidade}
                          unit={product.unidade}
                          max={product.stock}
                          disabled={busy}
                          onValueChange={(quantidade) =>
                            change(
                              "produtos",
                              draft.produtos.map((item) =>
                                item.key === line.key
                                  ? { ...item, quantidade }
                                  : item,
                              ),
                            )
                          }
                        />
                      </FormField>
                    )}
                    <Button
                      variant="cream"
                      disabled={draft.produtos.length === 1}
                      onClick={() => removeLine(line.key)}
                      aria-label={`Remover produto ${index + 1}`}
                    >
                      Remover
                    </Button>
                  </fieldset>
                );
              })}
              <Button
                variant="cream"
                disabled={draft.produtos.length >= products.length}
                onClick={addLine}
              >
                Adicionar produto
              </Button>
            </fieldset>
            <div className="auction-form__columns">
              <FormField
                id="auction-base"
                label="Preço base do lote (€)"
                required
                inputMode="decimal"
                value={draft.precoBase}
                onChange={(event) => change("precoBase", event.target.value)}
              />
              <FormField
                id="auction-increment"
                label="Incremento mínimo (€)"
                required
                inputMode="decimal"
                value={draft.incremento}
                onChange={(event) => change("incremento", event.target.value)}
              />
            </div>
            <FormField
              id="auction-start-mode"
              label="Início do leilão"
              unframed
              compact={false}
            >
              <Select
                id="auction-start-mode"
                value={draft.inicio}
                onValueChange={(value) =>
                  change("inicio", value as AuctionDraft["inicio"])
                }
                options={[
                  { value: "agora", label: "Começar agora" },
                  { value: "agendado", label: "Agendar" },
                ]}
              />
            </FormField>
            <div className="auction-form__columns">
              {draft.inicio === "agendado" && (
                <FormField
                  id="auction-start"
                  label="Data e hora de início"
                  type="datetime-local"
                  required
                  value={draft.dataInicio}
                  onChange={(event) => change("dataInicio", event.target.value)}
                />
              )}
              <FormField
                id="auction-end"
                label="Data e hora de fim"
                type="datetime-local"
                required
                value={draft.dataFim}
                onChange={(event) => change("dataFim", event.target.value)}
              />
            </div>
            <p>
              As datas usam a sua hora local. O stock é validado ao criar e
              reservado quando o leilão começa. Se já não estiver disponível, o
              leilão será cancelado.
            </p>
            <div className="producer-products__actions">
              <Button type="submit">
                {busy ? "A criar leilão…" : "Criar leilão"}
              </Button>
              {!busy && (
                <Button variant="cream" href="/produtor/produtos">
                  Cancelar
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      )}
      {!busy && (!loaded || !products.length) && (
        <Button href="/produtor/produtos" variant="cream">
          Gerir produtos
        </Button>
      )}
    </section>
  );
}
