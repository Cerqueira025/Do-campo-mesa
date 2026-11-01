import InternalLink from "../navigation/InternalLink";
import { restoreNavigation, returnToCatalog } from "../navigation/navigation";
import LoadingPlaceholder from "../components/ui/LoadingPlaceholder";
import { useEffect, useLayoutEffect, useState } from "react";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import ImageWithFallback from "../components/ui/ImageWithFallback";
import OriginMap from "../components/location/OriginMap";
import RelatedProducts from "../features/products/RelatedProducts";
import SessionNav from "../features/auth/components/SessionNav";
import {
  catalogReturnUrl,
  originMapUrl,
  priceFormatter,
  productImages,
  type ProductDetail,
} from "../features/products/product";
import { seasons } from "../features/home/catalogFilters";
import "./ProductDetailPage.scss";

export default function ProductDetailPage({ id }: { id: string | null }) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [status, setStatus] = useState<
    "loading" | "success" | "missing" | "error"
  >(id ? "loading" : "missing");
  const [retry, setRetry] = useState(0);
  const returnUrl = catalogReturnUrl(window.location.search);
  useLayoutEffect(() => {
    restoreNavigation(status !== "loading");
  }, [status]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/products/${id}`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          if (!controller.signal.aborted) setStatus("missing");
          return;
        }
        if (!response.ok) throw new Error("Produto indisponível");
        const data = (await response.json()) as ProductDetail;
        if (
          !data ||
          data._id!.toLowerCase() !== id!.toLowerCase() ||
          typeof data.nome !== "string" ||
          !Number.isSafeInteger(data.preco) ||
          !Number.isFinite(data.stock) ||
          !data.produtorId?.nome
        )
          throw new Error("Resposta inválida");
        if (!controller.signal.aborted) {
          setProduct(data);
          setStatus("success");
        }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [id, retry]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = product
      ? `${product.nome} · Do campo à mesa`
      : "Produto · Do campo à mesa";
    return () => {
      document.title = previousTitle;
    };
  }, [product]);

  const profile = product?.produtorId.perfilProdutor;
  const mapUrl = originMapUrl(profile?.coordenadas);
  const seasonNames = seasons
    .filter((season) => product?.epoca?.includes(season.value))
    .map((season) => season.label);
  const backNavigation = (
    <nav className="product-detail__back" aria-label="Regresso ao catálogo">
      <IconButton
        variant="cream"
        aria-label="Voltar ao catálogo"
        icon={<FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />}
        onClick={() => returnToCatalog(returnUrl)}
      />
      {status !== "success" && <span>Voltar ao catálogo</span>}
    </nav>
  );

  return (
    <main
      data-navigation-ready={status !== "loading"}
      className={`product-detail${status === "success" ? " product-detail--loaded" : ""}`}
    >
      {status === "success" && product && (
        <header className="product-detail__hero">
          <div className="product-detail__top-row">
            {backNavigation}
            <SessionNav className="product-detail__session" />
          </div>
          <div className="product-detail__visual">
            <ImageWithFallback
              {...productImages(product)}
              alt={product.nome}
              className="product-detail__image"
              sizes="495px"
              loading="eager"
            />
          </div>
          <div className="product-detail__heading">
            <p className="product-detail__eyebrow">
              Categoria · {product.categoria}
            </p>
            <h1>{product.nome}</h1>
            <p className="product-detail__price">
              {priceFormatter.format(product.preco / 100)}{" "}
              <span>/ {product.unidade}</span>
            </p>
          </div>
        </header>
      )}
      <div className="product-detail__inner">
        {status !== "success" && (
          <SessionNav className="product-detail__session" />
        )}
        {status !== "success" && backNavigation}
        {status === "loading" ? (
          <LoadingPlaceholder label="A carregar produto…" />
        ) : status === "missing" ? (
          <section className="product-detail__panel">
            <h1>Produto não encontrado</h1>
            <p>Este produto não existe ou já não está disponível.</p>
            <InternalLink href={returnUrl}>Explorar produtos</InternalLink>
          </section>
        ) : status === "error" ? (
          <section className="product-detail__panel" role="alert">
            <h1>Não foi possível carregar o produto</h1>
            <p>Tenta novamente dentro de instantes.</p>
            <Button
              onClick={() => {
                setStatus("loading");
                setRetry((value) => value + 1);
              }}
            >
              Tentar novamente
            </Button>
          </section>
        ) : (
          product && (
            <>
              <div className="product-detail__information">
                <dl className="product-detail__summary product-detail__panel">
                  <div>
                    <dt>Disponibilidade</dt>
                    <dd>{product.stock > 0 ? "Disponível" : "Esgotado"}</dd>
                  </div>
                  <div>
                    <dt>Origem</dt>
                    <dd>{profile?.localidade || "Não indicada"}</dd>
                  </div>
                </dl>
                <section
                  className="product-detail__description"
                  aria-labelledby="description-title"
                >
                  {product.biologico && (
                    <span className="product-detail__badge">Biológico</span>
                  )}
                  <h2 id="description-title">Sobre este produto</h2>
                  <p>{product.descricao || "Descrição não disponível."}</p>
                </section>
                <dl className="product-detail__facts product-detail__panel">
                  <div>
                    <dt>Categoria</dt>
                    <dd>{product.categoria}</dd>
                  </div>
                  <div>
                    <dt>Venda</dt>
                    <dd>Por {product.unidade}</dd>
                  </div>
                  {seasonNames.length > 0 && (
                    <div>
                      <dt>Épocas de produção</dt>
                      <dd>{seasonNames.join(" · ")}</dd>
                    </div>
                  )}
                </dl>
                <section
                  className="product-detail__panel"
                  aria-labelledby="producer-title"
                >
                  <div className="product-detail__producer">
                    <span className="product-detail__avatar" aria-hidden="true">
                      {product.produtorId.nome
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div>
                      <h2 id="producer-title">{product.produtorId.nome}</h2>
                      {profile?.localidade && <p>{profile.localidade}</p>}
                    </div>
                  </div>
                  {profile?.descricao && (
                    <p className="product-detail__producer-description">
                      {profile.descricao}
                    </p>
                  )}
                </section>
                <OriginMap locality={profile?.localidade} mapUrl={mapUrl} />
                <aside
                  className="product-detail__order"
                  aria-label="Encomendar produto"
                >
                  <div className="product-detail__order-row">
                    <div>
                      <span>Preço por {product.unidade}</span>
                      <strong>
                        {priceFormatter.format(product.preco / 100)}
                      </strong>
                    </div>
                    <Button disabled aria-describedby="order-note">
                      {product.stock > 0 ? "Encomendar agora" : "Esgotado"}
                    </Button>
                  </div>
                  <p id="order-note">
                    As encomendas ainda não estão disponíveis.
                  </p>
                </aside>
              </div>
              <RelatedProducts
                key={product._id}
                id={product._id}
                category={product.categoria}
                returnUrl={returnUrl}
              />
            </>
          )
        )}
      </div>
    </main>
  );
}
