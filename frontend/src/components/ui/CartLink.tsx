import { faCartShopping } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCart } from "../../features/cart/cartContext";
import IconButton from "./IconButton";
import "./CartLink.scss";

type CartLinkProps = {
  label?: string;
  className?: string;
};

export default function CartLink({
  label = "Carrinho",
  className = "",
}: CartLinkProps) {
  const { linhas } = useCart();
  const productCount = linhas.length;
  const accessibleLabel = `${label}: ${productCount} ${productCount === 1 ? "produto" : "produtos"} no carrinho`;
  return (
    <IconButton
      href="/carrinho"
      className={["cart-link", className].filter(Boolean).join(" ")}
      aria-label={accessibleLabel}
      icon={
        <span aria-hidden="true">
          <FontAwesomeIcon icon={faCartShopping} />
          <sup className="cart-link__count">{productCount}</sup>
        </span>
      }
    />
  );
}
