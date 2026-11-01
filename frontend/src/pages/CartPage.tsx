import FormField from "../components/ui/input/FormField";
import QuantityInput from "../components/ui/input/QuantityInput";
import Button from "../components/ui/Button";
import ImageWithFallback from "../components/ui/ImageWithFallback";
import InternalLink from "../navigation/InternalLink";
import { useCart } from "../features/cart/cartContext";
import { cartTotal, groupCart, lineTotal } from "../features/cart/cart";
import {
  priceFormatter,
  productHref,
  productImages,
} from "../features/products/product";
import { validPurchaseQuantity } from "../features/products/purchaseQuantity";
import OrderLayout from "../features/orders/OrderLayout";

export default function CartPage() {
  const { linhas, alterar, remover, canBuy } = useCart();
  const invalidLines = linhas.some(
    (line) =>
      !validPurchaseQuantity(
        line.quantidade,
        line.produto.unidade,
        line.produto.stock,
      ),
  );
  return (
    <OrderLayout title="O meu carrinho">
      {!linhas.length ? (
        <div className="order-page__panel">
          <p>O carrinho está vazio.</p>
          <Button href="/">Explorar produtos</Button>
        </div>
      ) : (
        <>
          {groupCart(linhas).map((group) => (
            <section
              className="order-page__panel"
              key={group.produtor._id}
              aria-label={`Produtos de ${group.produtor.nome}`}
            >
              <h2>{group.produtor.nome}</h2>
              <ul className="order-page__list">
                {group.linhas.map((line) => (
                  <li className="order-page__line" key={line.produto._id}>
                    <ImageWithFallback
                      {...productImages(line.produto)}
                      alt={line.produto.nome}
                      className="order-page__image"
                    />
                    <div>
                      <h3>
                        <InternalLink
                          className="order-page__link"
                          href={productHref(line.produto._id)}
                        >
                          {line.produto.nome}
                        </InternalLink>
                      </h3>
                      <p>
                        {priceFormatter.format(line.produto.preco / 100)} /{" "}
                        {line.produto.unidade}
                      </p>
                      <div className="order-page__quantity">
                        <FormField
                          unframed
                          id={`quantity-${line.produto._id}`}
                          label={`Quantidade (${line.produto.unidade})`}
                        >
                          <QuantityInput
                            id={`quantity-${line.produto._id}`}
                            unit={line.produto.unidade}
                            value={line.quantidade}
                            max={line.produto.stock}
                            disabled={line.produto.stock <= 0}
                            onValueChange={(value) => {
                              const quantity = Number(value);
                              if (
                                validPurchaseQuantity(
                                  quantity,
                                  line.produto.unidade,
                                  line.produto.stock,
                                )
                              ) {
                                alterar(line.produto._id, quantity);
                              }
                            }}
                          />
                        </FormField>
                      </div>
                    </div>
                    <div className="order-page__line-actions">
                      <strong>
                        {priceFormatter.format(lineTotal(line) / 100)}
                      </strong>
                      <Button
                        variant="cream"
                        aria-label={`Remover ${line.produto.nome}`}
                        onClick={() => remover(line.produto._id)}
                      >
                        Remover
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <p>
                Subtotal:{" "}
                <strong>
                  {priceFormatter.format(cartTotal(group.linhas) / 100)}
                </strong>
              </p>
            </section>
          ))}
          <div className="order-page__panel">
            <h2>Total: {priceFormatter.format(cartTotal(linhas) / 100)}</h2>
            <p>
              Será criada uma encomenda por produtor. O preço e o stock serão
              confirmados antes de finalizar.
            </p>
            {invalidLines && (
              <p className="order-page__error" role="status">
                Corrija as quantidades assinaladas no carrinho antes de
                finalizar.
              </p>
            )}
            <div className="order-page__actions">
              {canBuy &&
                (invalidLines ? (
                  <Button disabled>Finalizar compra</Button>
                ) : (
                  <Button href="/finalizar-encomenda">Finalizar compra</Button>
                ))}
              <Button href="/" variant="cream">
                Continuar a explorar
              </Button>
            </div>
          </div>
        </>
      )}
    </OrderLayout>
  );
}
