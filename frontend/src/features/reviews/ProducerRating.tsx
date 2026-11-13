import Button from "../../components/ui/Button";
import { faCommentDots } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import RatingSummary from "./RatingSummary";
import type { PublicReviews } from "./review";
import { useReviewData } from "./useReviewData";
import "./ProducerRating.scss";

export default function ProducerRating({ id }: { id: string }) {
  const { data, loading, error, refresh } = useReviewData<PublicReviews>(
    `/reviews/producers/${id}`,
  );
  return (
    <section
      className="producer-rating"
      aria-label="Avaliações recebidas"
      aria-busy={loading}
    >
      <h2>As suas avaliações</h2>
      <div className="producer-rating__content">
        {loading && !data && <p role="status">A carregar avaliações…</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <Button onClick={refresh}>Tentar novamente</Button>
          </div>
        )}
        {data && (
          <>
            {!data.total && (
              <FontAwesomeIcon
                className="producer-rating__empty-icon"
                icon={faCommentDots}
                aria-hidden="true"
              />
            )}
            <RatingSummary rating={data} />
          </>
        )}
      </div>
    </section>
  );
}
