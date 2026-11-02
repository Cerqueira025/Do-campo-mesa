import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { faRotateRight, faSliders } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "../components/ui/Button";
import LoadingPlaceholder from "../components/ui/LoadingPlaceholder";
import IconButton from "../components/ui/IconButton";
import FeaturedAuction from "../features/auctions/FeaturedAuction";
import ProductCard from "../components/product/ProductCard";
import SearchBar from "../components/ui/input/SearchBar";
import WelcomeHero from "../features/home/components/WelcomeHero";
import ProductFilters from "../features/home/components/ProductFilters";
import ActiveFilters from "../features/home/components/ActiveFilters";
import { useCart } from "../features/cart/cartContext";
import { initialPurchaseQuantity } from "../features/products/purchaseQuantity";
import {
  emptyFilters,
  readCatalogUrl,
  writeCatalogUrl,
  type FilterOptions,
} from "../features/home/catalogFilters";
import { mapProduct, productHref } from "../features/products/product";
import { useLocation } from "../navigation/useLocation";
import { locationSnapshot, restoreNavigation } from "../navigation/navigation";
import {
  catalogQuery,
  catalogPagination,
  readCatalogCache,
  writeCatalogCache,
  readFilterCache,
  writeFilterCache,
  readFiltersOpen,
  invalidateCatalogCache,
  writeFiltersOpen,
  type CatalogResponse,
} from "../features/home/catalogCache";
import "./HomePage.scss";

function HomePage() {
  const { adicionar, canBuy, message } = useCart();
  const [adding, setAdding] = useState<string[]>([]);
  const results = useRef<HTMLDivElement>(null);
  const pageTarget = useRef<string | null>(null);
  const location = useLocation();
  const filtersId = useId();
  const [isFiltersOpen, setIsFiltersOpen] = useState(readFiltersOpen);
  const { search, filters, page } = readCatalogUrl();
  const [draft, setDraft] = useState(() => ({ location, value: search }));
  const query = search.trim();
  const requestKey = catalogQuery(search, filters, page);
  const cached = useMemo(() => readCatalogCache(requestKey), [requestKey]);
  const [result, setResult] = useState<{
    key: string;
    data?: CatalogResponse;
    loading: boolean;
    error: boolean;
  }>(() => ({ key: requestKey, data: cached, loading: true, error: false }));
  const data = result.key === requestKey ? result.data : cached;
  const error = result.key === requestKey && result.error;
  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const pagination = catalogPagination(page, total);
  const correctingPage = Boolean(data) && pagination.page !== page && !error;
  const loading = result.key !== requestKey || result.loading || correctingPage;
  const [options, setOptions] = useState<FilterOptions | null>(readFilterCache);
  const [optionsError, setOptionsError] = useState(false);
  const [optionsRetry, setOptionsRetry] = useState(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    function refresh() {
      invalidateCatalogCache();
      setRetry((value) => value + 1);
    }
    window.addEventListener("reviews-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("reviews-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const requestedQuery = useRef(query);
  const hasFilters = Object.values(filters).some(Boolean);

  async function addProduct(id: string) {
    setAdding((current) => [...current, id]);
    try {
      await adicionar(id);
    } finally {
      setAdding((current) => current.filter((item) => item !== id));
    }
  }

  function changePage(next: number) {
    if (loading || next < 1 || next > pagination.pages) return;
    pageTarget.current = catalogQuery(search, filters, next);
    writeCatalogUrl(search, filters, false, next);
  }

  function retryProducts() {
    pageTarget.current = requestKey;
    setRetry((value) => value + 1);
  }

  const correctedPage = correctingPage ? pagination.page : page;
  useEffect(() => {
    if (correctedPage === page) return;
    const current = readCatalogUrl();
    if (pageTarget.current)
      pageTarget.current = catalogQuery(
        current.search,
        current.filters,
        correctedPage,
      );
    writeCatalogUrl(current.search, current.filters, true, correctedPage);
  }, [correctedPage, page]);

  function toggleFilters(open: boolean) {
    writeFiltersOpen(open);
    setIsFiltersOpen(open);
  }

  function closeFilters() {
    toggleFilters(false);
    document.getElementById(`${filtersId}-toggle`)?.focus();
  }

  useLayoutEffect(() => {
    if (pageTarget.current && pageTarget.current !== requestKey)
      pageTarget.current = null;
    restoreNavigation(Boolean(data) || !loading);
    if (!loading && pageTarget.current === requestKey) {
      pageTarget.current = null;
      results.current?.focus({ preventScroll: true });
      results.current?.scrollIntoView({ block: "start" });
    }
  }, [data, loading, location, requestKey]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOptions() {
      try {
        const response = await fetch("/api/products/filters", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Falha ao carregar opções.");
        const data = (await response.json()) as FilterOptions;
        if (
          !Array.isArray(data.categorias) ||
          !Array.isArray(data.produtores) ||
          !Array.isArray(data.localidades)
        )
          throw new Error("Opções inválidas.");
        if (!controller.signal.aborted) {
          writeFilterCache(data);
          setOptions(data);
          setOptionsError(false);
        }
      } catch {
        if (!controller.signal.aborted) setOptionsError(true);
      }
    }
    void loadOptions();
    return () => controller.abort();
  }, [optionsRetry]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      async () => {
        requestedQuery.current = query;
        setResult((previous) => ({
          key: requestKey,
          data:
            previous.key === requestKey
              ? previous.data
              : readCatalogCache(requestKey),
          loading: true,
          error: false,
        }));
        try {
          const response = await fetch(`/api/products?${requestKey}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Falha ao carregar os produtos.");
          const data = (await response.json()) as CatalogResponse;
          if (
            !Array.isArray(data.items) ||
            !Number.isInteger(data.total) ||
            data.total < 0
          )
            throw new Error("Resposta de produtos inválida.");
          if (!controller.signal.aborted) {
            writeCatalogCache(requestKey, data);
            setResult({ key: requestKey, data, loading: false, error: false });
          }
        } catch {
          if (!controller.signal.aborted)
            setResult((previous) => ({
              ...previous,
              loading: false,
              error: true,
            }));
        }
      },
      query !== requestedQuery.current ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, requestKey, retry]);

  return (
    <main
      className="home-page"
      data-navigation-ready={Boolean(data) || !loading}
    >
      <WelcomeHero />

      <section
        className="home-page__auction page-content"
        aria-label="Leilão em destaque"
      >
        <div className="home-page__auction-inner">
          <FeaturedAuction />
        </div>
      </section>

      <section
        className="home-page__products page-content"
        aria-labelledby="products-title"
      >
        <div className="home-page__products-inner">
          <h2 className="home-page__products-title" id="products-title">
            Explorar produtos
          </h2>

          <div className="home-page__search">
            <IconButton
              id={`${filtersId}-toggle`}
              className="home-page__filters-toggle"
              variant="primary"
              aria-label={
                isFiltersOpen ? "Colapsar filtros" : "Mostrar filtros"
              }
              aria-expanded={isFiltersOpen}
              aria-controls={filtersId}
              icon={<FontAwesomeIcon icon={faSliders} aria-hidden="true" />}
              onClick={() => toggleFilters(!isFiltersOpen)}
            />
            <SearchBar
              value={draft.location === location ? draft.value : search}
              onChange={(value) => {
                const next = value.slice(0, 100);
                writeCatalogUrl(next, filters, true);
                setDraft({ location: locationSnapshot(), value: next });
              }}
            />
          </div>
          <ActiveFilters
            value={filters}
            options={options}
            onRemove={(key) =>
              writeCatalogUrl(search, { ...filters, [key]: "" }, false)
            }
          />
          <div
            className={`home-page__catalog${isFiltersOpen ? " home-page__catalog--filters-open" : ""}`}
          >
            <ProductFilters
              id={filtersId}
              isOpen={isFiltersOpen}
              onClose={closeFilters}
              value={filters}
              options={options}
              optionsError={optionsError}
              onChange={(value) => writeCatalogUrl(search, value, false)}
              onClear={() =>
                writeCatalogUrl(search, { ...emptyFilters }, false)
              }
              onViewResults={() =>
                document
                  .getElementById("products-results")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              onRetry={() => {
                setOptionsError(false);
                setOptionsRetry((value) => value + 1);
              }}
            />
            <div
              ref={results}
              tabIndex={-1}
              className="home-page__results"
              id="products-results"
              aria-busy={loading}
            >
              <p className="home-page__message" role="status">
                {adding.length ? "A adicionar ao carrinho…" : message}
              </p>
              {(!data && loading) || correctingPage ? (
                <LoadingPlaceholder label="A carregar produtos…" />
              ) : !data && error ? (
                <div className="home-page__error" role="alert">
                  <p>Não foi possível carregar os produtos.</p>
                  <Button icon={faRotateRight} onClick={retryProducts}>
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <>
                  <p
                    className="home-page__message"
                    role="status"
                    aria-live="polite"
                  >
                    {error ? (
                      <>
                        Não foi possível atualizar os produtos. A mostrar os
                        resultados anteriores.{" "}
                        <Button variant="cream" onClick={retryProducts}>
                          Tentar novamente
                        </Button>
                      </>
                    ) : (
                      <>
                        A mostrar{" "}
                        {total ? `${pagination.first}–${pagination.last}` : "0"}{" "}
                        de {total} produtos.
                        {` Página ${page} de ${pagination.pages}.`}
                        {loading && " A atualizar…"}
                      </>
                    )}
                  </p>
                  {products.length > 0 ? (
                    <ul
                      className={`row row-cols-1 row-cols-md-2 ${isFiltersOpen ? "row-cols-lg-1 row-cols-xl-2" : "row-cols-lg-3"} home-page__product-grid`}
                    >
                      {products.map((product) => (
                        <li className="col" key={product._id}>
                          <ProductCard
                            product={mapProduct(product)}
                            onAdd={
                              canBuy &&
                              !adding.includes(product._id) &&
                              initialPurchaseQuantity(
                                product.unidade,
                                product.stock,
                              ) > 0
                                ? () => void addProduct(product._id)
                                : undefined
                            }
                            href={productHref(
                              product._id,
                              `/${window.location.search}${window.location.hash}`,
                            )}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      className="home-page__empty"
                      role="status"
                      aria-live="polite"
                    >
                      {query || hasFilters
                        ? "Não foram encontrados produtos para a pesquisa e os filtros selecionados."
                        : "Ainda não existem produtos disponíveis."}
                    </p>
                  )}
                  {pagination.pages > 1 && (
                    <nav
                      aria-label="Paginação do catálogo"
                      className="home-page__pagination"
                    >
                      <Button
                        variant="cream"
                        disabled={loading || page <= 1}
                        onClick={() => changePage(page - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="cream"
                        disabled={loading || page >= pagination.pages}
                        onClick={() => changePage(page + 1)}
                      >
                        Seguinte
                      </Button>
                    </nav>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
