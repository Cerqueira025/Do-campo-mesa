import Button from "../../components/ui/Button";
import RatingSummary from "./RatingSummary";
import type { PublicReviews } from "./review";
import { useReviewData } from "./useReviewData";

export default function ProducerRating({ id }: { id: string }) {
  const { data, loading, error, refresh } = useReviewData<PublicReviews>(
    `/reviews/producers/${id}`,
  );
  return (
    <section aria-label="Avaliações recebidas" aria-busy={loading}>
      <h2>As suas avaliações</h2>
      {loading && !data && <p role="status">A carregar avaliações…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={refresh}>Tentar novamente</Button>
        </div>
      )}
      {data && <RatingSummary rating={data} />}
      <Button href={`/produtores/${id}`} variant="cream">
        Ver perfil público
      </Button>
    </section>
  );
}
