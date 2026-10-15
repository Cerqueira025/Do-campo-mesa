import { useEffect, useId, useRef, useState } from 'react'
import { faRotateRight, faSliders } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import azeiteImage from '../assets/Azeite.png'
import Button from '../components/ui/Button'
import IconButton from '../components/ui/IconButton'
import AuctionCard from '../components/auction/AuctionCard'
import ProductCard, { type ProductCardProduct } from '../components/product/ProductCard'
import SearchBar from '../components/ui/SearchBar'
import WelcomeHero from '../features/home/components/WelcomeHero'
import ProductFilters from '../features/home/components/ProductFilters'
import { emptyFilters, readCatalogUrl, writeCatalogUrl, type CatalogFilters, type FilterOptions } from '../features/home/catalogFilters'
import { mapProduct, productHref, type ApiProduct } from '../features/products/product'
import './HomePage.scss'

interface ProductsResponse {
  items: ApiProduct[]
  total: number
}

function HomePage() {
  const filtersId = useId()
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [demoAuction] = useState(() => ({
    name: 'Azeite',
    lotDescription: 'Lote de 12 garrafas · 500 ml',
    image: azeiteImage,
    currentBid: 8400,
    endsAt: Date.now() + (18 * 60 + 42) * 1000,
    participants: 10,
  }))
  const [catalog, setCatalog] = useState(readCatalogUrl)
  const { search, filters } = catalog
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [optionsError, setOptionsError] = useState(false)
  const [optionsRetry, setOptionsRetry] = useState(0)
  const [total, setTotal] = useState(0)
  const [products, setProducts] = useState<Array<ProductCardProduct & { id: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const query = search.trim()
  const requestedQuery = useRef('')
  const hasFilters = Object.values(filters).some(Boolean)

  function closeFilters() {
    setIsFiltersOpen(false)
    document.getElementById(`${filtersId}-toggle`)?.focus()
  }

  function changeSearch(value: string) {
    const nextSearch = value.slice(0, 100)
    setCatalog({ search: nextSearch, filters })
    writeCatalogUrl(nextSearch, filters, true)
  }

  function changeFilters(value: CatalogFilters) {
    setCatalog({ search, filters: value })
    writeCatalogUrl(search, value, false)
  }

  useEffect(() => {
    const restore = () => setCatalog(readCatalogUrl())
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    async function loadOptions() {
      try {
        const response = await fetch('/api/products/filters', { signal: controller.signal })
        if (!response.ok) throw new Error('Falha ao carregar opções.')
        const data = await response.json() as FilterOptions
        if (!Array.isArray(data.categorias) || !Array.isArray(data.produtores) || !Array.isArray(data.localidades)) {
          throw new Error('Opções inválidas.')
        }
        if (!controller.signal.aborted) setOptions(data)
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
      setIsLoading(true)
      setError(false)

      try {
        const params = new URLSearchParams({ limit: '24' })
        if (query) params.set('q', query)
        for (const [key, value] of Object.entries(filters)) {
          if (value) params.set(key, value)
        }

        const response = await fetch(`/api/products?${params}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Falha ao carregar os produtos.')

        const data = (await response.json()) as ProductsResponse
        if (!Array.isArray(data.items) || !Number.isInteger(data.total) || data.total < 0) {
          throw new Error('Resposta de produtos inválida.')
        }

        if (!controller.signal.aborted) {
          setProducts(data.items.map(mapProduct))
          setTotal(data.total)
        }
      } catch (requestError) {
        if (controller.signal.aborted) return
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(true)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, query !== requestedQuery.current ? 250 : 0)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query, filters, retry])

  return (
    <main className="home-page">
      <WelcomeHero />

      <section className="home-page__auction" aria-label="Leilão em destaque">
        <div className="home-page__auction-inner">
          <AuctionCard auction={demoAuction} />
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
              onClick={() => setIsFiltersOpen((open) => !open)} />
            <SearchBar value={search} onChange={changeSearch} />
          </div>
          <div className={`home-page__catalog${isFiltersOpen ? ' home-page__catalog--filters-open' : ''}`}>
            <ProductFilters id={filtersId} isOpen={isFiltersOpen} onClose={closeFilters}
              value={filters} options={options} optionsError={optionsError}
              onChange={changeFilters} onClear={() => changeFilters({ ...emptyFilters })}
              onViewResults={() => document.getElementById('products-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              onRetry={() => {
                setOptionsError(false)
                setOptionsRetry((value) => value + 1)
              }} />
            <div className="home-page__results" id="products-results">
              {isLoading ? (
                <p className="home-page__message" role="status" aria-live="polite">
                  A carregar produtos…
                </p>
              ) : error ? (
                <div className="home-page__error" role="alert">
                  <p>Não foi possível carregar os produtos.</p>
                  <Button icon={faRotateRight} onClick={() => setRetry((value) => value + 1)}>
                    Tentar novamente
                  </Button>
                </div>
              ) : products.length > 0 ? (
                <>
                  <p className="home-page__message" role="status" aria-live="polite">
                    A mostrar {products.length} de {total} produtos.
                  </p>
                  <ul className={`row row-cols-1 row-cols-md-2 ${isFiltersOpen ? 'row-cols-lg-1 row-cols-xl-2' : 'row-cols-lg-3'} home-page__product-grid`}>
                    {products.map((product) => (
                      <li className="col" key={product.id}>
                        <ProductCard product={product} href={productHref(product.id, `/${window.location.search}`)} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="home-page__empty" role="status" aria-live="polite">
                  {query || hasFilters
                    ? 'Não foram encontrados produtos para a pesquisa e os filtros selecionados.'
                    : 'Ainda não existem produtos disponíveis.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default HomePage
