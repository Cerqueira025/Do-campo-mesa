import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import CartPage from "../src/pages/CartPage";
import CartProvider from "../src/features/cart/CartProvider";
import { useCart } from "../src/features/cart/cartContext";
import { cartStorageKey } from "../src/features/cart/cart";
import { AuthContext } from "../src/features/auth/authContext";
import { authValue, product } from "./fixtures";

vi.mock("../src/features/orders/OrderLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

function AddProduct() {
  const { adicionar } = useCart();
  return (
    <button onClick={() => void adicionar(product._id)}>
      Adicionar Batata
    </button>
  );
}

function Cart() {
  return (
    <AuthContext.Provider value={authValue()}>
      <CartProvider>
        <AddProduct />
        <CartPage />
      </CartProvider>
    </AuthContext.Provider>
  );
}

test("Adiciona, altera, recupera após remontagem e remove um produto do carrinho", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(product)));
  const view = render(<Cart />);
  expect(screen.getByText("O carrinho está vazio.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Adicionar Batata" }));
  await screen.findByRole("heading", { name: "Batata" });
  const quantity = screen.getByRole("spinbutton") as HTMLInputElement;
  expect(quantity.value).toBe("1");
  fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
  expect(quantity.value).toBe("1.5");
  expect(screen.getByRole("heading", { name: /Total:/ }).textContent).toMatch(
    /2,25/,
  );
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem(cartStorageKey)!)[0].quantidade,
    ).toBe(1.5),
  );
  view.unmount();
  render(<Cart />);
  expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(
    "1.5",
  );
  fireEvent.click(screen.getByRole("button", { name: "Remover Batata" }));
  expect(screen.getByText("O carrinho está vazio.")).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(cartStorageKey)!)).toEqual([]);
});

test("Uma quantidade acima do stock não altera o carrinho persistido", () => {
  localStorage.setItem(
    cartStorageKey,
    JSON.stringify([{ produto: product, quantidade: 1 }]),
  );
  render(<Cart />);
  const quantity = screen.getByRole("spinbutton");
  fireEvent.change(quantity, { target: { value: "6" } });
  fireEvent.blur(quantity);
  expect((quantity as HTMLInputElement).value).toBe("1");
  expect(JSON.parse(localStorage.getItem(cartStorageKey)!)[0].quantidade).toBe(
    1,
  );
});
