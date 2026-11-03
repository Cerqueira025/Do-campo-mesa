import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import CheckoutPage from "../src/pages/CheckoutPage";
import CartProvider from "../src/features/cart/CartProvider";
import { cartStorageKey } from "../src/features/cart/cart";
import { AuthContext } from "../src/features/auth/authContext";
import { navigate } from "../src/navigation/navigation";
import { authValue, product } from "./fixtures";

vi.mock("../src/features/orders/OrderLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("../src/navigation/navigation", async (original) => ({
  ...(await original<typeof import("../src/navigation/navigation")>()),
  navigate: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(navigate).mockClear();
  localStorage.setItem(
    cartStorageKey,
    JSON.stringify([{ produto: product, quantidade: 1 }]),
  );
});

async function checkout(currentProduct = product) {
  const fetch = vi.fn().mockResolvedValue(Response.json(currentProduct));
  vi.stubGlobal("fetch", fetch);
  const request = vi.fn().mockResolvedValue([{ _id: "order-1" }]);
  render(
    <AuthContext.Provider value={authValue({ request })}>
      <CartProvider>
        <CheckoutPage />
      </CartProvider>
    </AuthContext.Provider>,
  );
  const button = screen.getByRole("button", { name: "Confirmar encomendas" });
  await waitFor(() =>
    expect(
      screen.queryByText("A confirmar preços e disponibilidade…"),
    ).toBeNull(),
  );
  return { request, fetch, button, form: button.closest("form")! };
}

test("Impede a compra quando o stock deixou de ser suficiente", async () => {
  const { button, request, form } = await checkout({ ...product, stock: 0.5 });
  expect(screen.getByRole("alert").textContent).toContain("stock disponível");
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(form);
  expect(request).not.toHaveBeenCalled();
});

test("Atualiza o preço e o total antes de confirmar a encomenda", async () => {
  const { request, button } = await checkout({ ...product, preco: 250 });
  expect(screen.getByRole("status").textContent).toContain("Reveja o resumo");
  expect(screen.getByRole("heading", { name: /Total:/ }).textContent).toMatch(
    /2,50/,
  );
  fireEvent.click(button);
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/encomendas", { replace: true }),
  );
  expect(request).toHaveBeenCalledWith("/orders", {
    method: "POST",
    body: {
      linhas: [{ produtoId: product._id, quantidade: 1 }],
      entrega: { tipo: "levantamento" },
    },
  });
  expect(JSON.parse(localStorage.getItem(cartStorageKey)!)).toEqual([]);
});

test("Exige morada para entrega e envia a morada sem espaços nas extremidades", async () => {
  const { request, form } = await checkout();
  fireEvent.change(
    screen.getByLabelText("Como pretende receber os produtos?"),
    {
      target: { value: "entrega" },
    },
  );
  fireEvent.submit(form);
  expect(screen.getByRole("alert").textContent).toContain("Indique a morada");
  expect(request).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Morada completa/), {
    target: { value: " Rua da Horta, 10 " },
  });
  fireEvent.submit(form);
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  expect(request.mock.calls[0][1].body.entrega).toEqual({
    tipo: "entrega",
    morada: "Rua da Horta, 10",
  });
});

test("Não duplica pedidos pendentes nem perde o carrinho numa falha de rede", async () => {
  const { request, form } = await checkout();
  let reject!: (error: Error) => void;
  request.mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(request).toHaveBeenCalledOnce();
  expect(
    screen
      .getByRole("button", { name: "A criar encomendas…" })
      .hasAttribute("disabled"),
  ).toBe(true);
  await act(async () => reject(new TypeError("Failed to fetch")));
  expect(screen.getByRole("alert").textContent).toContain(
    "Consulte as encomendas",
  );
  expect(JSON.parse(localStorage.getItem(cartStorageKey)!)).toHaveLength(1);
  expect(navigate).not.toHaveBeenCalled();
});
