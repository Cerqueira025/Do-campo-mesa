import { useEffect, useRef, useState, type FormEvent } from "react";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/input/FormField";
import ImageWithFallback from "../../components/ui/ImageWithFallback";
import { useAuth } from "../auth/useAuth";
import { invalidateCatalogCache } from "../home/catalogCache";
import type { ProducerProduct } from "./management";
import { productImages } from "./product";
import "./ProductPhoto.scss";

export default function ProductPhoto({
  product,
  disabled,
  onBusy,
  onChange,
}: {
  product: ProducerProduct;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onChange: (product: ProducerProduct) => void;
}) {
  const { request } = useAuth();
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectionKey, setSelectionKey] = useState(0);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error || message) feedback.current?.focus();
  }, [error, message]);
  async function save(remove = false) {
    if (pending.current || disabled || (!remove && !file)) return;
    pending.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await request<ProducerProduct>(
        `/products/${product._id}/photo`,
        {
          method: remove ? "DELETE" : "PUT",
          ...(remove ? {} : { body: file }),
        },
      );
      onChange(updated);
      invalidateCatalogCache();
      setFile(undefined);
      setSelectionKey((value) => value + 1);
      setMessage(remove ? "Fotografia removida." : "Fotografia guardada.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível alterar a fotografia.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }
  const current = productImages(product);
  return (
    <section className="product-photo" aria-labelledby="product-photo-title">
      <h2 id="product-photo-title">Fotografia do produto</h2>
      <p>
        A fotografia é guardada separadamente dos restantes dados do produto.
      </p>
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
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset
          className="producer-products__fields"
          disabled={disabled || busy}
        >
          <legend>Carregar ou substituir fotografia</legend>
          <ProductPhotoSelection
            key={selectionKey}
            product={product}
            onSelect={setFile}
          />
          <div className="producer-products__actions">
            <Button type="submit" disabled={!file}>
              {busy ? "A guardar…" : "Guardar fotografia"}
            </Button>
            {current.image && (
              <Button variant="cream" onClick={() => void save(true)}>
                Remover fotografia
              </Button>
            )}
          </div>
        </fieldset>
      </form>
    </section>
  );
}

export function ProductPhotoSelection({
  product,
  onSelect,
  onValidity,
}: {
  product?: ProducerProduct;
  onSelect: (file: File | undefined) => void;
  onValidity?: (valid: boolean) => void;
}) {
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);
  function select(file?: File) {
    onSelect(undefined);
    setPreview(undefined);
    let failure = "";
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type))
      failure = "Selecione uma fotografia JPEG, PNG ou WebP.";
    else if (file && (!file.size || file.size > 5 * 1024 * 1024))
      failure = "A fotografia deve ter conteúdo e não ultrapassar 5 MiB.";
    setError(failure);
    onValidity?.(!failure);
    if (failure) {
      if (input.current) input.current.value = "";
      return;
    }
    onSelect(file);
    if (file) setPreview(URL.createObjectURL(file));
  }
  return (
    <div className="product-photo__selection">
      {(preview || product) && (
        <ImageWithFallback
          {...(preview ? { image: preview } : productImages(product!))}
          alt={
            preview
              ? product
                ? `Pré-visualização de ${product.nome}`
                : "Pré-visualização da fotografia"
              : product!.nome
          }
          className="product-photo__preview"
          sizes="320px"
        />
      )}
      <FormField
        id="product-photo-file"
        label={product ? "Nova fotografia" : "Fotografia"}
        hint="JPEG, PNG ou WebP estático, até 5 MiB e 25 milhões de píxeis."
      >
        <input
          id="product-photo-file"
          type="file"
          ref={input}
          accept="image/jpeg,image/png,image/webp"
          aria-invalid={Boolean(error)}
          aria-describedby={`product-photo-file-hint${error ? " product-photo-file-error" : ""}`}
          onChange={(event) => select(event.target.files?.[0])}
        />
      </FormField>
      {error && (
        <p
          id="product-photo-file-error"
          className="producer-products__error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
