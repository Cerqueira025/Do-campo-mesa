import InternalLink from "../../navigation/InternalLink";
import IconButton from "../ui/IconButton";
import ProductImage from "./ProductImage";
import "./ProductCard.scss";

export interface ProductCardProduct {
  title: string;
  category: string;
  weight: string;
  image?: string;
  srcSet?: string;
  imageAlt?: string;
}

interface ProductCardProps {
  product: ProductCardProduct;
  onAdd?: (product: ProductCardProduct) => void;
  href?: string;
}

function ProductCard({ product, onAdd, href }: ProductCardProps) {
  return (
    <article className="card product-card">
      <h3 className="product-card__title">
        {href ? (
          <InternalLink href={href}>
            <span>{product.title}</span>
          </InternalLink>
        ) : (
          product.title
        )}
      </h3>

      <div className="product-card__body">
        <div className="product-card__details">
          <p className="product-card__category">{product.category}</p>
          <p className="product-card__weight">{product.weight}</p>
        </div>

        <ProductImage
          className="product-card__image"
          image={product.image}
          srcSet={product.srcSet}
          sizes="(min-width: 1200px) 240px, (min-width: 768px) 30vw, 60vw"
          loading="lazy"
          alt={product.imageAlt ?? product.title}
        />
      </div>

      <IconButton
        className="product-card__add"
        variant="cream"
        aria-label={`Adicionar ${product.title} ao carrinho`}
        icon={<span aria-hidden="true">+</span>}
        disabled={!onAdd}
        onClick={() => onAdd?.(product)}
      />
    </article>
  );
}

export default ProductCard;
