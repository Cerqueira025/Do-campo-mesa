import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import InternalLink from "../../navigation/InternalLink";
import { useAuth } from "../auth/useAuth";
import type { ProducerProduct, ProductPage } from "../products/management";

const quantity = new Intl.NumberFormat("pt-PT");

export default function ProducerLowStock() {
  const { request } = useAuth();
  const [products, setProducts] = useState<ProducerProduct[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const lowStock: ProducerProduct[] = [];
      for (let page = 1; ; page++) {
        const result = await request<ProductPage>(
          `/products/mine?page=${page}&limit=100`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        lowStock.push(...result.items.filter(
          (product) => product.publicado && !product.bloqueado && product.stock <= 5,
        ));
        if (page * result.limit >= result.total) break;
      }
      setProducts(lowStock
        .sort((a, b) => a.stock - b.stock || a.nome.localeCompare(b.nome, "pt-PT"))
        .slice(0, 5));
    }
    void load().catch((failure) => {
      if (controller.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : "Não foi possível consultar o stock.");
    });
    return () => controller.abort();
  }, [request, revision]);

  return (
    <section className="producer-summary__panel">
      <h2>Stock baixo</h2>
      {error && (
        <div role="alert" className="order-page__error">
          <p>{error}</p>
          <Button onClick={() => {
            setError("");
            setRevision((value) => value + 1);
          }}>
            Voltar a consultar stock
          </Button>
        </div>
      )}
      {!products && !error && <LoadingPlaceholder label="A carregar stock…" />}
      {products?.length === 0 && <p>Sem avisos de stock baixo.</p>}
      {!!products?.length && (
        <ul className="producer-summary__list">
          {products.map((product) => (
            <li className="producer-summary__stock" key={product._id}>
              <InternalLink className="order-page__link" href={`/produtor/produtos/${product._id}`}>
                {product.nome}
              </InternalLink>
              <strong>
                {quantity.format(product.stock)} {product.unidade === "unidade" ? "un." : product.unidade}
              </strong>
            </li>
          ))}
        </ul>
      )}
      <Button href="/produtor/produtos" variant="cream">Ver produtos</Button>
    </section>
  );
}
