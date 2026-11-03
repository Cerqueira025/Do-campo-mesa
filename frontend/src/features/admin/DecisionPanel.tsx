import { useEffect, useId, useRef, useState } from "react";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/input/FormField";
import { ApiError } from "../../api/client";
import { useAuth } from "../auth/useAuth";
import { adminDate, referenceName, type AdminRecord } from "./admin";
import InternalLink from "../../navigation/InternalLink";
import { notifyReviewChange } from "../reviews/review";

interface DecisionAction {
  label: string;
  body: Record<string, string | boolean>;
  reason: boolean;
}
export default function DecisionPanel({
  item,
  path,
  actions,
  onSaved,
}: {
  item: AdminRecord;
  path: string;
  actions: DecisionAction[];
  onSaved: () => void;
}) {
  const { request } = useAuth();
  const id = useId();
  const [selected, setSelected] = useState<DecisionAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const observedDecision = useRef<string | null>(null);
  const observedUpdate = useRef<string | undefined>(undefined);
  const isReview = path.startsWith("/reviews/");
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const lastAction = useRef("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (selected) heading.current?.focus();
    else if (lastAction.current)
      (
        panel.current?.querySelector<HTMLButtonElement>(
          "[data-decision-action]",
        ) ?? panel.current
      )?.focus();
  }, [selected, actions.length]);
  async function save() {
    if (!selected || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(path, {
        method: "PATCH",
        body: {
          ...selected.body,
          motivo: reason.trim(),
          decisaoAnterior: observedDecision.current,
          ...(isReview ? { atualizadoEm: observedUpdate.current } : {}),
        },
      });
      if (isReview) notifyReviewChange();
      setMessage("Decisão guardada.");
      setSelected(null);
      setReason("");
      onSaved();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível guardar a decisão.",
      );
      if (failure instanceof ApiError && failure.status === 409) {
        setSelected(null);
        onSaved();
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="admin-page__panel"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`}>Decisão administrativa</h2>
      {item.ultimaDecisao ? (
        <>
          <p>
            {referenceName(item.ultimaDecisao.administradorId)} ·{" "}
            {adminDate(item.ultimaDecisao.data)}
          </p>
          {item.ultimaDecisao.motivo && (
            <p className="admin-page__text">
              Motivo: {item.ultimaDecisao.motivo}
            </p>
          )}
        </>
      ) : (
        <p>Sem decisão administrativa registada.</p>
      )}
      <p role="status">{message}</p>
      {error && (
        <p className="admin-page__error" role="alert">
          {error}
        </p>
      )}
      {!selected ? (
        <div className="admin-page__actions">
          {actions.map((action) => (
            <Button
              key={action.label}
              data-decision-action
              onClick={() => {
                observedDecision.current = item.ultimaDecisao?.data ?? null;
                observedUpdate.current = item.updatedAt;
                lastAction.current = action.label;
                setSelected(action);
                setReason("");
                setError("");
                setMessage("");
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : (
        <form
          className="admin-page__confirmation"
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h3 ref={heading} tabIndex={-1}>
            {selected.label}: confirmar decisão
          </h3>
          <p>A decisão tem efeito imediato.</p>
          {selected.body.bloqueado === true && (
            <>
              <p>
                O produto e os leilões associados ficam indisponíveis
                publicamente e não aceitam novas compras ou lances. Os leilões
                ativos mantêm os lances e as reservas e podem gerar uma
                encomenda ao terminar. Os agendados podem ser cancelados no
                início se o produto continuar oculto. Encomendas existentes
                mantêm-se.
              </p>
              <h4>Leilões associados</h4>
              {item.leiloes?.length ? (
                <ul>
                  {item.leiloes.map((auction) => (
                    <li key={auction._id}>
                      <InternalLink href={`/admin/leiloes/${auction._id}`}>
                        {auction.lote}
                      </InternalLink>{" "}
                      · {auction.estado} · fim {adminDate(auction.dataFim)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Sem leilões associados.</p>
              )}
            </>
          )}
          {selected.reason && (
            <FormField id={`${id}-reason`} label="Motivo (obrigatório)">
              <textarea
                id={`${id}-reason`}
                required
                maxLength={500}
                value={reason}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
          )}
          <div className="admin-page__actions">
            <Button
              type="submit"
              disabled={busy || (selected.reason && !reason.trim())}
            >
              {busy ? "A guardar…" : "Confirmar"}
            </Button>
            <Button
              variant="cream"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
