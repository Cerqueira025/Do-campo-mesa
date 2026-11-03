import { invalidateCatalogCache } from "../home/catalogCache.ts";

export interface Rating {
  media: number | null;
  total: number;
}

export interface PublicReview {
  _id: string;
  autorId: { _id: string; nome: string } | null;
  classificacao: number;
  comentario: string;
  createdAt: string;
}

export interface PublicReviews extends Rating {
  items: PublicReview[];
}

const number = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });
export function ratingText(rating?: Rating) {
  return rating?.total && rating.media !== null
    ? `${number.format(rating.media)} de 5 · ${rating.total} ${rating.total === 1 ? "avaliação" : "avaliações"}`
    : "Sem avaliações";
}

export function notifyReviewChange() {
  invalidateCatalogCache();
  window.dispatchEvent(new Event("reviews-changed"));
}
