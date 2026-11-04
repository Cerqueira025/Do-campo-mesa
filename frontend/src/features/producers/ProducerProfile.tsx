import "../products/ProducerProducts.scss";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/input/FormField";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import type { Registration } from "../auth/auth";
import { useAuth } from "../auth/useAuth";
import { invalidateCatalogCache } from "../home/catalogCache";
import { restoreNavigation } from "../../navigation/navigation";
import "./ProducerProfile.scss";

type Profile = NonNullable<Registration["perfilProdutor"]>;

export default function ProducerProfile() {
  const { request } = useAuth();
  const [profile, setProfile] = useState<Profile>();
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    void request<Profile>("/producers/me", { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) {
          setProfile(value);
          setLoading(false);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Não foi possível carregar o perfil.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [request, retry]);
  useEffect(() => {
    restoreNavigation(!loading);
  }, [loading]);
  useEffect(() => {
    if (error || message) feedback.current?.focus();
  }, [error, message]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !profile) return;
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const text = (field: string) => String(data.get(field) ?? "").trim();
    const value: Profile = {
      descricao: text("descricao"),
      localidade: text("localidade"),
      morada: text("morada"),
      coordenadas: {
        latitude: Number(text("latitude")),
        longitude: Number(text("longitude")),
      },
    };
    if (
      !value.localidade ||
      !value.morada ||
      !text("latitude") ||
      !text("longitude") ||
      !Number.isFinite(value.coordenadas.latitude) ||
      !Number.isFinite(value.coordenadas.longitude) ||
      Math.abs(value.coordenadas.latitude) > 90 ||
      Math.abs(value.coordenadas.longitude) > 180
    ) {
      setError("Preencha a localidade, a morada e coordenadas válidas.");
      return;
    }
    const body = Object.fromEntries(
      Object.entries(value).filter(
        ([key, entry]) =>
          JSON.stringify(entry) !==
          JSON.stringify(profile[key as keyof Profile]),
      ),
    );
    pending.current = true;
    setBusy(true);
    try {
      if (Object.keys(body).length) {
        setProfile(
          await request<Profile>("/producers/me", { method: "PATCH", body }),
        );
        invalidateCatalogCache();
      }
      setMessage("Perfil da exploração guardado.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível guardar o perfil.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className="producer-products__panel producer-profile"
      data-navigation-ready={!loading}
    >
      {(error || message) && (
        <p
          ref={feedback}
          tabIndex={-1}
          role={error ? "alert" : "status"}
          className={error ? "producer-products__error" : undefined}
        >
          {error || message}
        </p>
      )}
      {loading ? (
        <LoadingPlaceholder label="A carregar perfil…" />
      ) : profile ? (
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset className="producer-products__fields" disabled={busy}>
            <legend>Dados da exploração</legend>
            <FormField id="profile-description" label="Descrição (opcional)">
              <textarea
                id="profile-description"
                name="descricao"
                rows={4}
                defaultValue={profile.descricao}
              />
            </FormField>
            <FormField
              id="profile-locality"
              label="Localidade"
              name="localidade"
              autoComplete="address-level2"
              required
              defaultValue={profile.localidade}
            />
            <FormField
              id="profile-address"
              label="Morada"
              name="morada"
              autoComplete="street-address"
              required
              defaultValue={profile.morada}
            />
            <div className="producer-profile__coordinates">
              <FormField
                id="profile-latitude"
                label="Latitude"
                name="latitude"
                type="number"
                step="any"
                min={-90}
                max={90}
                required
                defaultValue={profile.coordenadas.latitude}
              />
              <FormField
                id="profile-longitude"
                label="Longitude"
                name="longitude"
                type="number"
                step="any"
                min={-180}
                max={180}
                required
                defaultValue={profile.coordenadas.longitude}
              />
            </div>
            <div className="producer-products__actions">
              <Button type="submit">
                {busy ? "A guardar…" : "Guardar perfil"}
              </Button>
              {!busy && (
                <Button href="/conta" variant="cream">
                  Cancelar
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      ) : (
        <Button
          onClick={() => {
            setError("");
            setLoading(true);
            setRetry((value) => value + 1);
          }}
        >
          Tentar novamente
        </Button>
      )}
      {!busy && !profile && (
        <Button href="/conta" variant="cream">
          Voltar à conta
        </Button>
      )}
    </section>
  );
}
