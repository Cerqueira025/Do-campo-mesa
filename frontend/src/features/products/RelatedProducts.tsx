import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import ProductCard from "../../components/product/ProductCard";
import { mapProduct, productHref, type ApiProduct } from "./product";
import "./RelatedProducts.scss";

export default function RelatedProducts({
  id,
  category,
  returnUrl,
}: {
  id: string;
  category: string;
  returnUrl: string;
}) {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const params = new URLSearchParams({ categoria: category, limit: "4" });
        const response = await fetch(`/api/products?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Produtos indisponíveis");
        const data = (await response.json()) as { items: ApiProduct[] };
        if (!Array.isArray(data.items)) throw new Error("Resposta inválida");
        if (!controller.signal.aborted) {
          setProducts(
            data.items.filter((product) => product._id !== id).slice(0, 3),
          );
          setStatus("success");
        }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [id, category, retry]);

  if (status === "success" && products.length === 0) return null;
  return (
    <section className="related-products" aria-labelledby="related-title">
      <h2 id="related-title">Mais produtos</h2>
      {status === "loading" ? (
        <p role="status">A carregar mais produtos…</p>
      ) : status === "error" ? (
        <div role="alert">
          <p>Não foi possível carregar mais produtos.</p>
          <Button
            onClick={() => {
              setStatus("loading");
              setRetry((value) => value + 1);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <ul className="related-products__grid">
          {products.map((product) => (
            <li key={product._id}>
              <ProductCard
                product={mapProduct(product)}
                href={productHref(product._id, returnUrl)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
