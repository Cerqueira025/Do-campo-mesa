import IconButton from '../ui/IconButton'
import './ProductCard.scss'

export interface ProductCardProduct {
  title: string
  category: string
  weight: string
  image?: string
  imageAlt?: string
}

interface ProductCardProps {
  product: ProductCardProduct
  onAdd?: (product: ProductCardProduct) => void
}

function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <article className="card product-card">
      <h3 className="product-card__title">{product.title}</h3>

      <div className="product-card__body">
        <div className="product-card__details">
          <p className="product-card__category">{product.category}</p>
          <p className="product-card__weight">{product.weight}</p>
        </div>

        {product.image && (
          <img
            className="product-card__image"
            src={product.image}
            alt={product.imageAlt ?? product.title}
          />
        )}
      </div>

      <IconButton
        className="product-card__add"
        variant="product"
        aria-label={`Adicionar ${product.title} ao carrinho`}
        icon={<span aria-hidden="true">+</span>}
        disabled={!onAdd}
        onClick={() => onAdd?.(product)}
      />
    </article>
  )
}

export default ProductCard
