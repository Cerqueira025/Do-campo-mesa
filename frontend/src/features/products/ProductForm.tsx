import "./ProducerProducts.scss";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/input/FormField";
import Select from "../../components/ui/input/Select";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import { navigate, restoreNavigation } from "../../navigation/navigation";
import { seasons } from "../home/catalogFilters";
import { invalidateCatalogCache } from "../home/catalogCache";
import ProductPhoto, { ProductPhotoSelection } from "./ProductPhoto";
import {
  productDraft,
  productPayload,
  type ProducerProduct,
  type ProductDraft,
} from "./management";

export default function ProductForm({ id }: { id?: string }) {
  const { request } = useAuth();
  const [original, setOriginal] = useState<ProducerProduct>();
  const [draft, setDraft] = useState(() => productDraft());
  const [loading, setLoading] = useState(Boolean(id));
  const [loaded, setLoaded] = useState(!id);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<File>();
  const [photoValid, setPhotoValid] = useState(true);
  const [created, setCreated] = useState<ProducerProduct>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    void request<ProducerProduct>(`/products/mine/${id}`, {
      signal: controller.signal,
    })
      .then((product) => {
        if (!controller.signal.aborted) {
          setOriginal(product);
          setDraft(productDraft(product));
          setLoaded(true);
          setLoading(false);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Não foi possível carregar o produto.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [id, request, retry]);
  useEffect(() => {
    restoreNavigation(!loading);
  }, [loading]);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error, loading]);
  function change<K extends keyof ProductDraft>(
    key: K,
    value: ProductDraft[K],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || photoBusy || !photoValid) return;
    setError("");
    try {
      const body = created ? {} : productPayload(draft, original);
      if (id && !Object.keys(body).length) {
        navigate(`/produtor/produtos/${id}`);
        return;
      }
      pending.current = true;
      setBusy(true);
      const saved =
        created ??
        (await request<ProducerProduct>(`/products${id ? `/${id}` : ""}`, {
          method: id ? "PUT" : "POST",
          body,
        }));
      if (!id) setCreated(saved);
      invalidateCatalogCache();
      if (!id && photo) {
        await request(`/products/${saved._id}/photo`, {
          method: "PUT",
          body: photo,
        });
        invalidateCatalogCache();
      }
      navigate(`/produtor/produtos/${saved._id}?guardado=1`);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível guardar o produto.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const seasonOptions = [
    ...seasons,
    ...draft.epoca
      .filter((value) => !seasons.some((season) => season.value === value))
      .map((value) => ({ value, label: value })),
  ];
  return (
    <section
      className="producer-products__panel"
      data-navigation-ready={!loading}
    >
      <Button
        className="producer-products__back"
        href="/produtor/produtos"
        variant="cream"
      >
        Voltar aos meus produtos
      </Button>
      {error && (
        <p
          className="producer-products__error"
          role="alert"
          ref={alert}
          tabIndex={-1}
        >
          {error}
        </p>
      )}
      {loading ? (
        <LoadingPlaceholder label="A carregar produto…" />
      ) : !loaded ? (
        <Button
          onClick={() => {
            setError("");
            setLoading(true);
            setRetry((value) => value + 1);
          }}
        >
          Tentar novamente
        </Button>
      ) : (
        <>
          {original?.bloqueado && (
            <p role="status">
              Bloqueado pela administração. A publicação não remove este
              bloqueio.
            </p>
          )}
          {created && (
            <p role="status">
              O produto foi criado. Falta enviar a fotografia. Pode repetir o
              envio ou consultar o produto sem fotografia.
            </p>
          )}
          <form onSubmit={submit} aria-busy={busy}>
            <fieldset
              className="producer-products__fields"
              disabled={busy || photoBusy}
            >
              <legend className="producer-products__sr-only">
                Formulário do produto
              </legend>
              <fieldset
                className="producer-products__fields"
                disabled={Boolean(created)}
              >
                <legend>Dados do produto</legend>
                <FormField
                  id="product-name"
                  label="Nome"
                  required
                  value={draft.nome}
                  onChange={(event) => change("nome", event.target.value)}
                />
                <FormField id="product-description" label="Descrição">
                  <textarea
                    id="product-description"
                    required
                    rows={4}
                    value={draft.descricao}
                    onChange={(event) =>
                      change("descricao", event.target.value)
                    }
                  />
                </FormField>
                <FormField
                  id="product-category"
                  label="Categoria"
                  required
                  value={draft.categoria}
                  onChange={(event) => change("categoria", event.target.value)}
                />
              </fieldset>
              <fieldset
                className="producer-products__fields"
                disabled={Boolean(created)}
              >
                <legend>Preço e stock</legend>
                <div className="producer-products__columns">
                  <FormField
                    id="product-price"
                    label="Preço (€ por unidade)"
                    inputMode="decimal"
                    required
                    value={draft.preco}
                    onChange={(event) => change("preco", event.target.value)}
                  />
                  <FormField
                    id="product-unit"
                    label="Unidade"
                    unframed
                    compact={false}
                  >
                    <Select
                      id="product-unit"
                      value={draft.unidade}
                      onValueChange={(value) =>
                        change("unidade", value as ProductDraft["unidade"])
                      }
                      options={["kg", "g", "l", "unidade"].map((unit) => ({
                        value: unit,
                        label: unit,
                      }))}
                    />
                  </FormField>
                  <FormField
                    id="product-stock"
                    label="Stock disponível"
                    inputMode="decimal"
                    required
                    value={draft.stock}
                    onChange={(event) => change("stock", event.target.value)}
                  />
                </div>
              </fieldset>
              <fieldset
                className="producer-products__fields"
                disabled={Boolean(created)}
              >
                <legend>Características e validade</legend>
                <fieldset className="producer-products__checks">
                  <legend>Épocas de produção (opcional)</legend>
                  {seasonOptions.map((season) => (
                    <label key={season.value}>
                      <input
                        type="checkbox"
                        checked={draft.epoca.includes(season.value)}
                        onChange={(event) =>
                          change(
                            "epoca",
                            event.target.checked
                              ? [...draft.epoca, season.value]
                              : draft.epoca.filter(
                                  (value) => value !== season.value,
                                ),
                          )
                        }
                      />{" "}
                      {season.label}
                    </label>
                  ))}
                </fieldset>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.biologico}
                    onChange={(event) =>
                      change("biologico", event.target.checked)
                    }
                  />{" "}
                  Produto biológico
                </label>
                <FormField
                  id="product-validity"
                  label="Data de validade (opcional)"
                  type="date"
                  value={draft.dataValidade}
                  onChange={(event) =>
                    change("dataValidade", event.target.value)
                  }
                />
              </fieldset>
              {!id && (
                <fieldset className="producer-products__fields">
                  <legend>Fotografia (opcional)</legend>
                  <ProductPhotoSelection
                    onSelect={setPhoto}
                    onValidity={setPhotoValid}
                  />
                </fieldset>
              )}
              <fieldset
                className="producer-products__fields"
                disabled={Boolean(created)}
              >
                <legend>Publicação</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.publicado}
                    onChange={(event) =>
                      change("publicado", event.target.checked)
                    }
                  />{" "}
                  Publicar no catálogo
                </label>
                <p>
                  Despublicar torna também os leilões associados indisponíveis
                  publicamente.
                </p>
              </fieldset>
              <div className="producer-products__actions">
                <Button type="submit" disabled={!photoValid}>
                  {busy
                    ? "A guardar…"
                    : created
                      ? "Repetir envio da fotografia"
                      : "Guardar produto"}
                </Button>
                {!busy && !photoBusy && (
                  <Button
                    href={
                      created
                        ? `/produtor/produtos/${created._id}`
                        : "/produtor/produtos"
                    }
                    variant="cream"
                  >
                    {created ? "Consultar produto sem fotografia" : "Cancelar"}
                  </Button>
                )}
              </div>
            </fieldset>
          </form>
          {original && (
            <ProductPhoto
              product={original}
              disabled={busy}
              onBusy={setPhotoBusy}
              onChange={(product) =>
                setOriginal((previous) =>
                  previous
                    ? { ...previous, fotografia: product.fotografia }
                    : previous,
                )
              }
            />
          )}
        </>
      )}
      {!busy && !loaded && (
        <Button href="/produtor/produtos" variant="cream">
          Voltar aos meus produtos
        </Button>
      )}
    </section>
  );
}
