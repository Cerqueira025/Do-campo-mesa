import { useEffect, useLayoutEffect } from "react";
import AppHeader from "../components/layout/AppHeader";
import OriginMap from "../components/location/OriginMap";
import ProductCard from "../components/product/ProductCard";
import Button from "../components/ui/Button";
import LoadingPlaceholder from "../components/ui/LoadingPlaceholder";
import { useCart } from "../features/cart/cartContext";
import {
  mapProduct,
  originMapUrl,
  productHref,
  type ApiProduct,
  type ProductDetail,
} from "../features/products/product";
import { initialPurchaseQuantity } from "../features/products/purchaseQuantity";
import ReviewList from "../features/reviews/ReviewList";
import type { PublicReviews } from "../features/reviews/review";
import { useReviewData } from "../features/reviews/useReviewData";
import { restoreNavigation } from "../navigation/navigation";
import "./ProducerDetailPage.scss";

interface ProducerDetail {
  _id: string;
  nome: string;
  perfilProdutor?: ProductDetail["produtorId"]["perfilProdutor"];
  produtos: ApiProduct[];
  avaliacoes: PublicReviews;
}

export default function ProducerDetailPage({ id }: { id: string }) {
  const {
    data: producer,
    loading,
    error,
    missing,
    refresh,
  } = useReviewData<ProducerDetail>(`/producers/${id}`);
  const { adicionar, canBuy, message } = useCart();
  useLayoutEffect(() => {
    restoreNavigation(!loading || Boolean(producer));
  }, [loading, producer]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${producer?.nome || "Produtor"} · Do campo à mesa`;
    return () => {
      document.title = previous;
    };
  }, [producer?.nome]);
  const profile = producer?.perfilProdutor;
  return (
    <main
      className="producer-detail"
      data-navigation-ready={!loading || Boolean(producer)}
    >
      <AppHeader />
      <div
        className="page-content producer-detail__inner"
        id="main-content"
        tabIndex={-1}
      >
        {loading && !producer && (
          <LoadingPlaceholder label="A carregar produtor…" />
        )}
        {missing ? (
          <>
            <h1>Produtor indisponível</h1>
            <p>Este perfil não está disponível publicamente.</p>
            <Button href="/">Ver catálogo</Button>
          </>
        ) : (
          error && (
            <div role="alert">
              <p>{error}</p>
              <Button onClick={refresh}>Tentar novamente</Button>
            </div>
          )
        )}
        {producer && (
          <>
            <section className="producer-detail__profile">
              <div>
                <p>Produtor local</p>
                <h1>{producer.nome}</h1>
                {profile?.localidade && <p>{profile.localidade}</p>}
                {profile?.descricao && (
                  <p className="producer-detail__description">
                    {profile.descricao}
                  </p>
                )}
              </div>
              <OriginMap
                locality={profile?.localidade}
                mapUrl={originMapUrl(profile?.coordenadas)}
              />
            </section>
            <section aria-labelledby="producer-products-title">
              <h2 id="producer-products-title">Produtos</h2>
              {message && <p role="status">{message}</p>}
              {producer.produtos.length === 0 ? (
                <p>Este produtor ainda não tem produtos disponíveis.</p>
              ) : (
                <ul className="producer-detail__products">
                  {producer.produtos.map((product) => (
                    <li key={product._id}>
                      <ProductCard
                        product={mapProduct(product)}
                        href={productHref(product._id)}
                        onAdd={
                          canBuy &&
                          initialPurchaseQuantity(
                            product.unidade,
                            product.stock ?? 0,
                          ) > 0
                            ? () => void adicionar(product._id)
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-label="Avaliações do produtor">
              <ReviewList reviews={producer.avaliacoes} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
