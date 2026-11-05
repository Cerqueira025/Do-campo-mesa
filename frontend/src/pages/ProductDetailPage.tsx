import FormField from "../components/ui/input/FormField";
import QuantityInput from "../components/ui/input/QuantityInput";
import { useCart } from "../features/cart/cartContext";
import InternalLink from "../navigation/InternalLink";
import { restoreNavigation, returnToCatalog } from "../navigation/navigation";
import LoadingPlaceholder from "../components/ui/LoadingPlaceholder";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Button from "../components/ui/Button";
import ImageWithFallback from "../components/ui/ImageWithFallback";
import OriginMap from "../components/location/OriginMap";
import RelatedProducts from "../features/products/RelatedProducts";
import PublicReviews from "../features/reviews/PublicReviews";
import AppHeader from "../components/layout/AppHeader";
import {
  catalogReturnUrl,
  originMapUrl,
  priceFormatter,
  productImages,
  type ProductDetail,
} from "../features/products/product";
import { seasons } from "../features/home/catalogFilters";
import { readCatalogProduct } from "../features/home/catalogCache";
import {
  initialPurchaseQuantity,
  validPurchaseQuantity,
} from "../features/products/purchaseQuantity";
import "./ProductDetailPage.scss";

export default function ProductDetailPage({ id }: { id: string | null }) {
  const { adicionar, canBuy, message } = useCart();
  const [editedQuantity, setQuantity] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const orderRef = useRef<HTMLElement>(null);
  const cachedProduct = useMemo(
    () => (id ? readCatalogProduct(id) : undefined),
    [id],
  );
  const [product, setProduct] = useState<ProductDetail | null>(
    cachedProduct ?? null,
  );
  const quantity =
    editedQuantity ??
    String(
      product ? initialPurchaseQuantity(product.unidade, product.stock) : 0,
    );
  const [status, setStatus] = useState<
    "loading" | "success" | "missing" | "error"
  >(cachedProduct ? "success" : id ? "loading" : "missing");
  const [retry, setRetry] = useState(0);
  const returnUrl = catalogReturnUrl(window.location.search);
  useLayoutEffect(() => {
    restoreNavigation(status !== "loading");
  }, [status]);

  useLayoutEffect(() => {
    const order = orderRef.current;
    if (!order) return;
    const observer = new ResizeObserver(() => {
      order
        .closest("main")
        ?.style.setProperty(
          "--product-order-height",
          `${order.getBoundingClientRect().height}px`,
        );
    });
    observer.observe(order);
    return () => observer.disconnect();
  }, [status, product?._id]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/products/${id}`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          if (!controller.signal.aborted) {
            if (cachedProduct) {
              setProduct(null);
              setStatus("missing");
            } else setStatus("missing");
          }
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
        if (!controller.signal.aborted && !cachedProduct) setStatus("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [id, retry, cachedProduct]);

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

  return (
    <main
      data-navigation-ready={status !== "loading"}
      className={`product-detail${status === "success" ? " product-detail--loaded" : ""}`}
    >
      {status === "success" && product && (
        <section className="product-detail__hero">
          <div className="product-detail__top-row">
            <AppHeader
              variant="overlay"
              onBack={() => returnToCatalog(returnUrl)}
            />
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
        </section>
      )}
      {status !== "success" && (
        <div className="product-detail__header">
          <AppHeader onBack={() => returnToCatalog(returnUrl)} />
        </div>
      )}
      <div
        className={`product-detail__inner${status !== "success" ? " page-content" : ""}`}
        id="main-content"
        tabIndex={-1}
      >
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
                <div className="product-detail__content page-content">
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
                      <span
                        className="product-detail__avatar"
                        aria-hidden="true"
                      >
                        {product.produtorId.nome
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                      <div>
                        <h2 id="producer-title">
                          <InternalLink
                            href={`/produtores/${product.produtorId._id}`}
                          >
                            {product.produtorId.nome}
                          </InternalLink>
                        </h2>
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
                </div>
                <div className="product-detail__purchase">
                  <aside
                    ref={orderRef}
                    className="product-detail__order"
                    aria-label="Encomendar produto"
                  >
                    <div className="product-detail__order-row">
                      <div className="product-detail__order-price">
                        <span>Preço por {product.unidade}</span>
                        <strong>
                          {priceFormatter.format(product.preco / 100)}
                        </strong>
                      </div>
                      <div className="product-detail__order-quantity">
                        <FormField
                          unframed
                          labelPosition="beside"
                          id="product-quantity"
                          label={`Quantidade (${product.unidade})`}
                        >
                          <QuantityInput
                            id="product-quantity"
                            unit={product.unidade}
                            max={product.stock}
                            value={quantity}
                            onValueChange={setQuantity}
                            disabled={adding || product.stock <= 0}
                          />
                        </FormField>
                      </div>
                      <div className="product-detail__order-actions">
                        <Button
                          disabled={
                            adding ||
                            !canBuy ||
                            !validPurchaseQuantity(
                              Number(quantity),
                              product.unidade,
                              product.stock,
                            )
                          }
                          onClick={async () => {
                            setAdding(true);
                            try {
                              if (
                                validPurchaseQuantity(
                                  Number(quantity),
                                  product.unidade,
                                  product.stock,
                                )
                              ) {
                                await adicionar(product._id, Number(quantity));
                              }
                            } finally {
                              setAdding(false);
                            }
                          }}
                        >
                          {product.stock > 0
                            ? adding
                              ? "A adicionar…"
                              : "Adicionar ao carrinho"
                            : "Esgotado"}
                        </Button>
                      </div>
                    </div>
                    {!canBuy && (
                      <p id="order-note">
                        As compras estão disponíveis para contas de comprador.
                      </p>
                    )}
                    {message && <p role="status">{message}</p>}
                  </aside>
                </div>
              </div>
              <div className="page-content">
                <PublicReviews
                  key={`reviews-${product._id}`}
                  path={`/reviews/products/${product._id}`}
                />
                <RelatedProducts
                  key={`related-${product._id}`}
                  id={product._id}
                  producerId={product.produtorId._id}
                  returnUrl={returnUrl}
                />
              </div>
            </>
          )
        )}
      </div>
    </main>
  );
}
