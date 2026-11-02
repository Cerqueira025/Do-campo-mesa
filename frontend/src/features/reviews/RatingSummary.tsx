import { ratingText, type Rating } from "./review";
import "./RatingSummary.scss";

export default function RatingSummary({ rating }: { rating?: Rating }) {
  return (
    <p className="rating-summary">
      {Boolean(rating?.total) && <span aria-hidden="true">★</span>}
      {ratingText(rating)}
    </p>
  );
}
