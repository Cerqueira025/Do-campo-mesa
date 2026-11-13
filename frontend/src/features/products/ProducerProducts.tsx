import "./ProducerProducts.scss";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../../api/client";
import Button from "../../components/ui/Button";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import ImageWithFallback from "../../components/ui/ImageWithFallback";
import { priceFormatter, productImages } from "./product";
import {
  producerPage,
  type ProducerProduct,
  type ProductPage,
} from "./management";
import { invalidateCatalogCache } from "../home/catalogCache";
import { navigate, restoreNavigation } from "../../navigation/navigation";

export default function ProducerProducts() {
  const { request } = useAuth();
  const page = producerPage(window.location.search);
  const [data, setData] = useState<ProductPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    new URLSearchParams(window.location.search).has("guardado")
      ? "Produto guardado."
      : "",
  );
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (deleting) confirmation.current?.focus();
  }, [deleting]);
  useEffect(() => {
    const controller = new AbortController();
    void request<ProductPage>(`/products/mine?page=${page}&limit=24`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(result.total / 24));
        if (page > lastPage) {
          navigate(`/produtor/produtos?page=${lastPage}`, { replace: true });
          return;
        }
        setData(result);
        setLoading(false);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure instanceof ApiError && [403, 404].includes(failure.status))
          setData(null);
        setError(
          failure instanceof Error
            ? failure.message
            : "Não foi possível carregar os produtos.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [request, page, revision]);
  useEffect(() => {
    restoreNavigation(!loading);
  }, [loading]);
  function refresh() {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }
  async function mutate(product: ProducerProduct, remove = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(`/products/${product._id}`, {
        method: remove ? "DELETE" : "PUT",
        ...(remove ? {} : { body: { publicado: !product.publicado } }),
      });
      invalidateCatalogCache();
      setMessage(
        remove
          ? "Produto apagado."
          : product.publicado
            ? "Produto despublicado."
            : "Produto publicado.",
      );
      setDeleting(null);
      if (remove) heading.current?.focus();
      refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível alterar o produto.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section data-navigation-ready={!loading}>
      <h2 className="producer-products__sr-only" ref={heading} tabIndex={-1}>
        Lista de produtos
      </h2>
      <div className="producer-products__actions">
        <Button href="/produtor/produtos/novo">Novo produto</Button>
      </div>
      <p role="status">{message}</p>
      {error && (
        <div className="producer-products__error" role="alert">
          <p>{error}</p>
          <Button onClick={refresh} disabled={busy}>
            Voltar a consultar produtos
          </Button>
        </div>
      )}
      {loading && <LoadingPlaceholder label="A carregar produtos…" />}
      {data && (
        <div aria-busy={loading || busy}>
          <p>
            {data.total} produtos · Página {data.page} de{" "}
            {Math.max(1, Math.ceil(data.total / 24))}
          </p>
          {!data.items.length ? (
            <p className="producer-products__panel">
              Ainda não tem produtos. Crie o seu primeiro produto.
            </p>
          ) : (
            <ul className="producer-products__list">
              {data.items.map((product) => (
                <li key={product._id} className="producer-products__panel">
                  <ImageWithFallback
                    {...productImages(product)}
                    className="producer-products__image"
                    alt={product.nome}
                    sizes="112px"
                    loading="lazy"
                  />
                  <div>
                    <h3>{product.nome}</h3>
                    <p>{product.categoria}</p>
                    <p>
                      {priceFormatter.format(product.preco / 100)} /{" "}
                      {product.unidade} · Stock: {product.stock}{" "}
                      {product.unidade}
                    </p>
                    <p>
                      {product.publicado ? "Publicado" : "Despublicado"}
                      {product.bloqueado
                        ? " · Bloqueado pela administração: indisponível publicamente."
                        : ""}
                    </p>
                    <div className="producer-products__actions">
                      <Button
                        href={`/produtor/produtos/${product._id}`}
                        variant="cream"
                      >
                        Consultar{" "}
                        <span className="producer-products__sr-only">
                          {product.nome}
                        </span>
                      </Button>
                      {!busy && (
                        <Button
                          href={`/produtor/produtos/${product._id}/editar`}
                          variant="cream"
                        >
                          Editar{" "}
                          <span className="producer-products__sr-only">
                            {product.nome}
                          </span>
                        </Button>
                      )}
                      <Button
                        disabled={busy || loading}
                        onClick={() => void mutate(product)}
                      >
                        {product.publicado ? "Despublicar" : "Publicar"}{" "}
                        <span className="producer-products__sr-only">
                          {product.nome}
                        </span>
                      </Button>
                      <Button
                        disabled={busy || loading}
                        variant="cream"
                        onClick={(event) => {
                          deleteTrigger.current = event.currentTarget;
                          setDeleting(product._id);
                        }}
                      >
                        Apagar{" "}
                        <span className="producer-products__sr-only">
                          {product.nome}
                        </span>
                      </Button>
                    </div>
                    {product.publicado && (
                      <p className="producer-products__note">
                        Despublicar torna também os leilões associados
                        indisponíveis publicamente.
                      </p>
                    )}
                    {deleting === product._id && (
                      <section
                        className="producer-products__confirmation"
                        aria-labelledby={`delete-${product._id}`}
                      >
                        <h4
                          ref={confirmation}
                          id={`delete-${product._id}`}
                          tabIndex={-1}
                        >
                          Apagar {product.nome}?
                        </h4>
                        <p>
                          Esta ação é definitiva. Produtos com leilões
                          associados não podem ser apagados.
                        </p>
                        <div className="producer-products__actions">
                          <Button
                            disabled={busy || loading}
                            onClick={() => void mutate(product, true)}
                          >
                            Confirmar eliminação
                          </Button>
                          <Button
                            disabled={busy}
                            variant="cream"
                            onClick={() => {
                              setDeleting(null);
                              deleteTrigger.current?.focus();
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </section>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <nav
            className="producer-products__actions"
            aria-label="Paginação de produtos"
          >
            <Button
              disabled={page <= 1 || busy || loading}
              variant="cream"
              onClick={() => navigate(`/produtor/produtos?page=${page - 1}`)}
            >
              Anterior
            </Button>
            <Button
              disabled={page * 24 >= data.total || busy || loading}
              variant="cream"
              onClick={() => navigate(`/produtor/produtos?page=${page + 1}`)}
            >
              Seguinte
            </Button>
          </nav>
        </div>
      )}
    </section>
  );
}
