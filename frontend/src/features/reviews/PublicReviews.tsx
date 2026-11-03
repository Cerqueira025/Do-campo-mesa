import Button from "../../components/ui/Button";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import ReviewList from "./ReviewList";
import type { PublicReviews as Reviews } from "./review";
import { useReviewData } from "./useReviewData";

export default function PublicReviews({ path }: { path: string }) {
  const { data, loading, error, refresh } = useReviewData<Reviews>(path);
  return (
    <section aria-label="Avaliações" aria-busy={loading}>
      {loading && !data && (
        <LoadingPlaceholder label="A carregar avaliações…" />
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={refresh}>Tentar novamente</Button>
        </div>
      )}
      {data && <ReviewList reviews={data} />}
    </section>
  );
}
