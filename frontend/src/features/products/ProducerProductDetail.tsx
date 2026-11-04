import "./ProducerProducts.scss";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import Button from "../../components/ui/Button";
import ImageWithFallback from "../../components/ui/ImageWithFallback";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import { restoreNavigation } from "../../navigation/navigation";
import { priceFormatter, productImages } from "./product";
import "./ProductPhoto.scss";
import { seasons } from "../home/catalogFilters";
import type { ProducerProduct } from "./management";

export default function ProducerProductDetail({ id }: { id: string }) {
  const { request } = useAuth();
  const [product, setProduct] = useState<ProducerProduct>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void request<ProducerProduct>(`/products/mine/${id}`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setProduct(value);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Não foi possível carregar o produto.",
          );
      });
    return () => controller.abort();
  }, [id, request, retry]);
  useEffect(() => {
    restoreNavigation(Boolean(product || error));
  }, [product, error]);
  return (
    <section
      className="producer-products__panel"
      data-navigation-ready={Boolean(product || error)}
    >
      <Button
        className="producer-products__back"
        href="/produtor/produtos"
        variant="cream"
      >
        Voltar aos meus produtos
      </Button>
      {new URLSearchParams(window.location.search).has("guardado") && (
        <p role="status">Produto guardado.</p>
      )}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button
            onClick={() => {
              setError("");
              setRetry((value) => value + 1);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : !product ? (
        <LoadingPlaceholder label="A carregar produto…" />
      ) : (
        <>
          <h2>{product.nome}</h2>
          <ImageWithFallback
            {...productImages(product)}
            alt={product.nome}
            className="product-photo__preview"
            sizes="320px"
          />
          <p>{product.descricao}</p>
          <dl className="producer-products__facts">
            <div>
              <dt>Categoria</dt>
              <dd>{product.categoria}</dd>
            </div>
            <div>
              <dt>Preço</dt>
              <dd>
                {priceFormatter.format(product.preco / 100)} / {product.unidade}
              </dd>
            </div>
            <div>
              <dt>Stock disponível</dt>
              <dd>
                {product.stock} {product.unidade}
              </dd>
            </div>
            <div>
              <dt>Épocas de produção</dt>
              <dd>
                {product.epoca
                  .map(
                    (value) =>
                      seasons.find((season) => season.value === value)?.label ??
                      value,
                  )
                  .join(", ") || "Não indicadas"}
              </dd>
            </div>
            <div>
              <dt>Produto biológico</dt>
              <dd>{product.biologico ? "Sim" : "Não"}</dd>
            </div>
            <div>
              <dt>Data de validade</dt>
              <dd>
                {product.dataValidade
                  ? new Date(product.dataValidade).toLocaleDateString("pt-PT", {
                      timeZone: "UTC",
                    })
                  : "Não indicada"}
              </dd>
            </div>
            <div>
              <dt>Publicação</dt>
              <dd>{product.publicado ? "Publicado" : "Despublicado"}</dd>
            </div>
            <div>
              <dt>Bloqueio administrativo</dt>
              <dd>{product.bloqueado ? "Bloqueado" : "Sem bloqueio"}</dd>
            </div>
          </dl>
          <Button href={`/produtor/produtos/${id}/editar`}>
            Editar produto
          </Button>
        </>
      )}
    </section>
  );
}
