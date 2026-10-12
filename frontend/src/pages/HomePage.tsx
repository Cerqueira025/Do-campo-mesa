import { useEffect, useState } from 'react'
import { faRotateRight } from '@fortawesome/free-solid-svg-icons'
import Button from '../components/ui/Button'
import ProductCard, { type ProductCardProduct } from '../components/product/ProductCard'
import SearchBar from '../components/ui/SearchBar'
import WelcomeHero from '../features/home/components/WelcomeHero'
import './HomePage.scss'

interface ApiProduct {
  _id: string
  nome: string
  categoria: string
  preco: number
  unidade: string
  imagens: string[]
}

interface ProductsResponse {
  items: ApiProduct[]
}

const priceFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

function mapProduct(product: ApiProduct): ProductCardProduct & { id: string } {
  return {
    id: product._id,
    title: product.nome,
    category: product.categoria,
    weight: `${priceFormatter.format(product.preco / 100)}/${product.unidade}`,
    ...(product.imagens[0] ? { image: product.imagens[0] } : {}),
  }
}

function HomePage() {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Array<ProductCardProduct & { id: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const query = search.trim()

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsLoading(true)
      setError(false)

      try {
        const params = new URLSearchParams({ limit: '24' })
        if (query) params.set('q', query)

        const response = await fetch(`/api/products?${params}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Falha ao carregar os produtos.')

        const data = (await response.json()) as ProductsResponse
        if (!Array.isArray(data.items)) throw new Error('Resposta de produtos inválida.')

        setProducts(data.items.map(mapProduct))
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(true)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query, retry])

  return (
    <main className="home-page">
      <WelcomeHero />

      <section className="home-page__products" aria-labelledby="products-title">
        <div className="home-page__products-inner">
          <h2 className="home-page__products-title" id="products-title">
            Explorar produtos
          </h2>

          <SearchBar value={search} onChange={setSearch} />

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
            <ul className="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 home-page__product-grid">
              {products.map((product) => (
                <li className="col" key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="home-page__empty" role="status" aria-live="polite">
              {query
                ? 'Não foram encontrados produtos para esta pesquisa.'
                : 'Ainda não existem produtos disponíveis.'}
            </p>
          )}
        </div>
      </section>
    </main>
  )
}

export default HomePage
