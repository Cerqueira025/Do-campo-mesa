import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { faRotateRight, faSliders } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Button from '../components/ui/Button'
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder'
import IconButton from '../components/ui/IconButton'
import FeaturedAuction from '../features/auctions/FeaturedAuction'
import ProductCard from '../components/product/ProductCard'
import SearchBar from '../components/ui/SearchBar'
import WelcomeHero from '../features/home/components/WelcomeHero'
import ProductFilters from '../features/home/components/ProductFilters'
import { emptyFilters, readCatalogUrl, writeCatalogUrl, type FilterOptions } from '../features/home/catalogFilters'
import { mapProduct, productHref } from '../features/products/product'
import { useLocation } from '../navigation/useLocation'
import { locationSnapshot, restoreNavigation } from '../navigation/navigation'
import { catalogQuery, readCatalogCache, writeCatalogCache, readFilterCache, writeFilterCache, readFiltersOpen, writeFiltersOpen, type CatalogResponse } from '../features/home/catalogCache'
import './HomePage.scss'

function HomePage() {
  const location = useLocation()
  const filtersId = useId()
  const [isFiltersOpen, setIsFiltersOpen] = useState(readFiltersOpen)
  const { search, filters } = readCatalogUrl()
  const [draft, setDraft] = useState(() => ({ location, value: search }))
  const query = search.trim()
  const requestKey = catalogQuery(search, filters)
  const cached = useMemo(() => readCatalogCache(requestKey), [requestKey])
  const [result, setResult] = useState<{ key: string; data?: CatalogResponse; loading: boolean; error: boolean }>(
    () => ({ key: requestKey, data: cached, loading: true, error: false }))
  const data = result.key === requestKey ? result.data : cached
  const loading = result.key !== requestKey || result.loading
  const error = result.key === requestKey && result.error
  const products = data?.items.map(mapProduct) ?? []
  const total = data?.total ?? 0
  const [options, setOptions] = useState<FilterOptions | null>(readFilterCache)
  const [optionsError, setOptionsError] = useState(false)
  const [optionsRetry, setOptionsRetry] = useState(0)
  const [retry, setRetry] = useState(0)
  const requestedQuery = useRef(query)
  const hasFilters = Object.values(filters).some(Boolean)

  function toggleFilters(open: boolean) {
    writeFiltersOpen(open)
    setIsFiltersOpen(open)
  }

  function closeFilters() {
    toggleFilters(false)
    document.getElementById(`${filtersId}-toggle`)?.focus()
  }

  useLayoutEffect(() => { restoreNavigation(Boolean(data) || !loading) }, [data, loading, location])

  useEffect(() => {
    const controller = new AbortController()
    async function loadOptions() {
      try {
        const response = await fetch('/api/products/filters', { signal: controller.signal })
        if (!response.ok) throw new Error('Falha ao carregar opções.')
        const data = await response.json() as FilterOptions
        if (!Array.isArray(data.categorias) || !Array.isArray(data.produtores) || !Array.isArray(data.localidades)) throw new Error('Opções inválidas.')
        if (!controller.signal.aborted) { writeFilterCache(data); setOptions(data); setOptionsError(false) }
      } catch {
        if (!controller.signal.aborted) setOptionsError(true)
      }
    }
    void loadOptions()
    return () => controller.abort()
  }, [optionsRetry])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      requestedQuery.current = query
      setResult(previous => ({ key: requestKey, data: previous.key === requestKey ? previous.data : readCatalogCache(requestKey), loading: true, error: false }))
      try {
        const response = await fetch(`/api/products?${requestKey}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Falha ao carregar os produtos.')
        const data = await response.json() as CatalogResponse
        if (!Array.isArray(data.items) || !Number.isInteger(data.total) || data.total < 0) throw new Error('Resposta de produtos inválida.')
        if (!controller.signal.aborted) {
          writeCatalogCache(requestKey, data)
          setResult({ key: requestKey, data, loading: false, error: false })
        }
      } catch {
        if (!controller.signal.aborted) setResult(previous => ({ ...previous, loading: false, error: true }))
      }
    }, query !== requestedQuery.current ? 250 : 0)
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [query, requestKey, retry])

  return (
    <main className="home-page" data-navigation-ready={Boolean(data) || !loading}>
      <WelcomeHero />

      <section className="home-page__auction" aria-label="Leilão em destaque">
        <div className="home-page__auction-inner">
          <FeaturedAuction />
        </div>
      </section>

      <section className="home-page__products" aria-labelledby="products-title">
        <div className="home-page__products-inner">
          <h2 className="home-page__products-title" id="products-title">
            Explorar produtos
          </h2>

          <div className="home-page__search">
            <IconButton id={`${filtersId}-toggle`} className="home-page__filters-toggle" variant="primary"
              aria-label={isFiltersOpen ? 'Colapsar filtros' : 'Mostrar filtros'}
              aria-expanded={isFiltersOpen} aria-controls={filtersId}
              icon={<FontAwesomeIcon icon={faSliders} aria-hidden="true" />}
              onClick={() => toggleFilters(!isFiltersOpen)} />
            <SearchBar value={draft.location === location ? draft.value : search} onChange={value => {
              const next = value.slice(0, 100)
              writeCatalogUrl(next, filters, true)
              setDraft({ location: locationSnapshot(), value: next })
            }} />
          </div>
          <div className={`home-page__catalog${isFiltersOpen ? ' home-page__catalog--filters-open' : ''}`}>
            <ProductFilters id={filtersId} isOpen={isFiltersOpen} onClose={closeFilters}
              value={filters} options={options} optionsError={optionsError}
              onChange={value => writeCatalogUrl(search, value, false)} onClear={() => writeCatalogUrl(search, { ...emptyFilters }, false)}
              onViewResults={() => document.getElementById('products-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              onRetry={() => {
                setOptionsError(false)
                setOptionsRetry((value) => value + 1)
              }} />
            <div className="home-page__results" id="products-results" aria-busy={loading}>
              {!data && loading ? (
                <LoadingPlaceholder label="A carregar produtos…" />
              ) : !data && error ? (
                <div className="home-page__error" role="alert">
                  <p>Não foi possível carregar os produtos.</p>
                  <Button icon={faRotateRight} onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button>
                </div>
              ) : (
                <>
                  <p className="home-page__message" role="status" aria-live="polite">
                    {error ? <>Não foi possível atualizar os produtos. A mostrar os resultados anteriores. <Button variant="cream" onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button></>
                      : <>A mostrar {products.length} de {total} produtos.{loading && ' A atualizar…'}</>}
                  </p>
                  {products.length > 0 ? (
                    <ul className={`row row-cols-1 row-cols-md-2 ${isFiltersOpen ? 'row-cols-lg-1 row-cols-xl-2' : 'row-cols-lg-3'} home-page__product-grid`}>
                      {products.map(product => (
                        <li className="col" key={product.id}>
                          <ProductCard product={product} href={productHref(product.id, `/${window.location.search}${window.location.hash}`)} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="home-page__empty" role="status" aria-live="polite">
                      {query || hasFilters ? 'Não foram encontrados produtos para a pesquisa e os filtros selecionados.' : 'Ainda não existem produtos disponíveis.'}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default HomePage
