import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/input/FormField";
import { useAuth } from "../auth/useAuth";
import { notifyReviewChange, type PublicReviews } from "./review";
import RatingSummary from "./RatingSummary";
import "./ReviewList.scss";

const date = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" });

function ReportForm({
  id,
  onSaved,
  onCancel,
}: {
  id: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { request } = useAuth();
  const field = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textarea.current?.focus();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || !reason.trim()) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await request(`/reviews/${id}/denuncias`, {
        method: "POST",
        body: { motivo: reason.trim() },
      });
      onSaved();
      notifyReviewChange();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível registar a denúncia.",
      );
      if (failure instanceof ApiError && [404, 409].includes(failure.status))
        notifyReviewChange();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      className="review-list__report"
      onSubmit={(event) => void submit(event)}
      aria-busy={busy}
    >
      <p>
        A avaliação deixará de estar pública até ser analisada pela
        administração.
      </p>
      <FormField id={field} label="Motivo da denúncia">
        <textarea
          ref={textarea}
          id={field}
          required
          maxLength={500}
          value={reason}
          disabled={busy}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      {error && (
        <p role="alert" className="review-list__error">
          {error}
        </p>
      )}
      <div className="review-list__actions">
        <Button type="submit" disabled={busy || !reason.trim()}>
          {busy ? "A enviar…" : "Confirmar denúncia"}
        </Button>
        <Button variant="cream" disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export default function ReviewList({ reviews }: { reviews: PublicReviews }) {
  const { utilizador } = useAuth();
  const [reporting, setReporting] = useState<string | null>(null);
  const [reported, setReported] = useState<{
    snapshot: PublicReviews;
    ids: string[];
  } | null>(null);
  const hidden = reported?.snapshot === reviews ? reported.ids : [];
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <div className="review-list">
      <h2 className="review-list__title" ref={heading} tabIndex={-1}>
        Opiniões dos compradores
      </h2>
      {hidden.length ? (
        <p role="status">A atualizar avaliações…</p>
      ) : (
        <RatingSummary rating={reviews} />
      )}
      <p role="status">{message}</p>
      {reviews.items.length > 0 && (
        <ul className="review-list__items">
          {reviews.items
            .filter((review) => !hidden.includes(review._id))
            .map((review) => (
              <li key={review._id} className="review-list__item">
                <article>
                  <div className="review-list__author">
                    <h3>{review.autorId?.nome || "Autor indisponível"}</h3>
                    <time dateTime={review.createdAt}>
                      {date.format(new Date(review.createdAt))}
                    </time>
                  </div>
                  <p className="review-list__score">
                    {review.classificacao} de 5
                  </p>
                  <p className="review-list__comment">{review.comentario}</p>
                  {reporting === review._id ? (
                    <ReportForm
                      id={review._id}
                      onCancel={() => {
                        setReporting(null);
                        heading.current?.focus();
                      }}
                      onSaved={() => {
                        setReporting(null);
                        setReported({
                          snapshot: reviews,
                          ids: [...hidden, review._id],
                        });
                        setMessage("Denúncia registada.");
                        heading.current?.focus();
                      }}
                    />
                  ) : utilizador &&
                    ["comprador", "produtor"].includes(utilizador.papel) &&
                    utilizador.id !== review.autorId?._id ? (
                    <Button
                      variant="cream"
                      onClick={() => {
                        setMessage("");
                        setReporting(review._id);
                      }}
                    >
                      Denunciar
                    </Button>
                  ) : null}
                </article>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
