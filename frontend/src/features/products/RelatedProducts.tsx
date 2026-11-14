import { useCart } from "../cart/cartContext";
import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import ProductCard from "../../components/product/ProductCard";
import { mapProduct, productHref, type ApiProduct } from "./product";
import { initialPurchaseQuantity } from "./purchaseQuantity";
import "./RelatedProducts.scss";

export default function RelatedProducts({
  id,
  producerId,
  returnUrl,
}: {
  id: string;
  producerId: string;
  returnUrl: string;
}) {
  const { adicionar, canBuy, message } = useCart();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const refresh = () => setRetry((value) => value + 1);
    window.addEventListener("reviews-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("reviews-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const params = new URLSearchParams({
          produtorId: producerId,
          limit: "7",
        });
        const response = await fetch(`/api/products?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Produtos indisponíveis");
        const data = (await response.json()) as { items: ApiProduct[] };
        if (!Array.isArray(data.items)) throw new Error("Resposta inválida");
        if (!controller.signal.aborted) {
          setProducts(
            data.items.filter((product) => product._id !== id).slice(0, 6),
          );
          setStatus("success");
        }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [id, producerId, retry]);

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
        <>
          {message && <p role="status">{message}</p>}
          <ul className="related-products__grid">
            {products.map((product) => (
              <li key={product._id}>
                <ProductCard
                  product={mapProduct(product)}
                  onAdd={
                    canBuy &&
                    initialPurchaseQuantity(
                      product.unidade,
                      product.stock ?? 0,
                    ) > 0
                      ? () => void adicionar(product._id)
                      : undefined
                  }
                  href={productHref(product._id, returnUrl)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
