import { useRef, useState, type FormEvent } from "react";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/input/FormField";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import { ApiError } from "../../api/client";
import { useAuth } from "../auth/useAuth";
import type { Order, Review } from "./order";
import { useOrderPolling } from "./useOrderPolling";
import { notifyReviewChange } from "../reviews/review";

function ReviewForm({
  orderId,
  target,
  onSaved,
}: {
  orderId: string;
  target: { id: string; name: string; type: "produtoId" | "produtorId" };
  onSaved: () => void;
}) {
  const { request } = useAuth();
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const id = `review-${target.type}-${target.id}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    if (!comment.trim()) {
      setError("Escreva um comentário.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await request("/reviews", {
        method: "POST",
        body: {
          encomendaId: orderId,
          [target.type]: target.id,
          classificacao: Number(rating),
          comentario: comment.trim(),
        },
      });
      notifyReviewChange();
      onSaved();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível guardar a avaliação.",
      );
      if (failure instanceof ApiError && failure.status === 409) onSaved();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      className="order-page__form"
      onSubmit={(event) => void submit(event)}
      aria-busy={busy}
    >
      <FormField id={`${id}-rating`} label={`Classificação de ${target.name}`}>
        <select
          id={`${id}-rating`}
          value={rating}
          disabled={busy}
          onChange={(event) => setRating(event.target.value)}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} de 5
            </option>
          ))}
        </select>
      </FormField>
      <FormField id={`${id}-comment`} label="Comentário">
        <textarea
          id={`${id}-comment`}
          required
          value={comment}
          disabled={busy}
          onChange={(event) => setComment(event.target.value)}
        />
      </FormField>
      {error && (
        <p role="alert" className="order-page__error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "A guardar…" : "Publicar avaliação"}
      </Button>
    </form>
  );
}

export default function OrderReviews({ order }: { order: Order }) {
  const { data, error, refresh } = useOrderPolling<Review[]>(
    `/orders/${order._id}/reviews`,
  );
  const [saved, setSaved] = useState<string[]>([]);
  const targets = [
    ...order.linhas.map((line) => ({
      id: line.produtoId,
      name: line.nome,
      type: "produtoId" as const,
    })),
    ...(order.produtorId
      ? [
          {
            id: order.produtorId._id,
            name: order.produtorId.nome,
            type: "produtorId" as const,
          },
        ]
      : []),
  ];
  return (
    <section className="order-page__panel">
      <h2>Avaliar esta encomenda</h2>
      <p>Pode avaliar uma vez cada produto e o produtor desta encomenda.</p>
      {error && (
        <div role="alert" className="order-page__error">
          <p>{error}</p>
          <Button onClick={refresh}>Tentar novamente</Button>
        </div>
      )}
      {!data && !error && <LoadingPlaceholder label="A carregar avaliações…" />}
      {data &&
        targets.map((target) => {
          const review = data.find((item) => item[target.type] === target.id);
          return (
            <section
              className="order-page__panel"
              key={`${target.type}-${target.id}`}
            >
              <h3>{target.name}</h3>
              {review ? (
                <>
                  <p>
                    Avaliação registada: {review.classificacao} de 5 ·{" "}
                    {review.estado}
                  </p>
                  <p>{review.comentario}</p>
                </>
              ) : saved.includes(`${target.type}-${target.id}`) ? (
                <p role="status">Avaliação registada. A atualizar os dados…</p>
              ) : (
                <ReviewForm
                  orderId={order._id}
                  target={target}
                  onSaved={() => {
                    setSaved((current) => [
                      ...current,
                      `${target.type}-${target.id}`,
                    ]);
                    refresh();
                  }}
                />
              )}
            </section>
          );
        })}
    </section>
  );
}
