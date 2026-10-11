import { useState } from 'react'
import ProductCard, { type ProductCardProduct } from '../components/product/ProductCard'
import SearchBar from '../components/ui/SearchBar'
import WelcomeHero from '../features/home/components/WelcomeHero'
import './HomePage.scss'

const products: Array<ProductCardProduct & { id: string }> = [
  {
    id: 'batata',
    title: 'Batata',
    category: 'Produtos frescos',
    weight: '5€/kg',
    image: '/images/batata.png',
    imageAlt: 'Ilustração de batatas frescas',
  },
]

function HomePage() {
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase('pt-PT')
  const visibleProducts = products.filter((product) =>
    [product.title, product.category].some((field) =>
      field.toLocaleLowerCase('pt-PT').includes(query),
    ),
  )

  return (
    <main className="home-page">
      <WelcomeHero />

      <section className="home-page__products" aria-labelledby="products-title">
        <div className="home-page__products-inner">
          <h2 className="home-page__products-title" id="products-title">
            Explorar produtos
          </h2>

          <SearchBar value={search} onChange={setSearch} />

          {visibleProducts.length > 0 ? (
            <ul className="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 home-page__product-grid">
              {visibleProducts.map((product) => (
                <li className="col" key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="home-page__empty" role="status">
              Não foram encontrados produtos para esta pesquisa.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}

export default HomePage
