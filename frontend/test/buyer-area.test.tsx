import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import AppRoutes from "../src/navigation/AppRoutes";
import { AuthContext } from "../src/features/auth/authContext";
import { navigate } from "../src/navigation/navigation";
import { authValue, mockDesktopQuery } from "./fixtures";

vi.mock("../src/features/cart/cartContext", () => ({
  useCart: () => ({ canBuy: false, confirmadas: [], linhas: [] }),
}));

const orderId = "dca000000000000000000065";

beforeEach(() => {
  document.title = "Do campo à mesa";
  vi.stubGlobal("scrollTo", vi.fn());
});

function mount(path = "/conta") {
  window.history.replaceState(null, "", path);
  const request = vi.fn(async (url: string) => {
    if (url === "/orders") return [];
    throw new Error("Encomenda não encontrada");
  });
  render(
    <AuthContext.Provider value={authValue({ request })}>
      <AppRoutes />
    </AuthContext.Provider>,
  );
  return request;
}

function expectPage(title: string, selected: string) {
  const menu = screen.getByRole("navigation", { name: "Área pessoal" });
  expect(screen.getAllByRole("banner")).toHaveLength(1);
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name: title })).toBeTruthy();
  expect(screen.getByRole("main").contains(menu)).toBe(false);
  expect(within(menu).getByRole("link", { current: "page" }).textContent).toBe(
    selected,
  );
  expect(document.title).toBe(`${title} · Do campo à mesa`);
}

test.each([
  ["/conta", "A minha conta", "A minha conta"],
  ["/encomendas", "As minhas encomendas", "As minhas encomendas"],
  [`/encomendas/${orderId}`, "Detalhe da encomenda", "As minhas encomendas"],
])("Acesso direto a %s usa a área pessoal", (path, title, selected) => {
  mount(path);
  expectPage(title, selected);
});

test("Navegação e histórico preservam menu, cabeçalho e foco", async () => {
  mount();
  const menu = screen.getByRole("navigation", { name: "Área pessoal" });
  const header = screen.getByRole("banner");
  fireEvent.click(within(menu).getByRole("link", { name: "As minhas encomendas" }));
  await screen.findByText("Ainda não há encomendas.");
  expectPage("As minhas encomendas", "As minhas encomendas");
  expect(screen.getByRole("banner")).toBe(header);
  expect(screen.getByRole("navigation", { name: "Área pessoal" })).toBe(menu);
  expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));

  act(() => navigate(`/encomendas/${orderId}`));
  expectPage("Detalhe da encomenda", "As minhas encomendas");
  expect(screen.getByText("A carregar encomenda…")).toBeTruthy();
  await screen.findByRole("alert");
  expect(screen.getByText("Encomenda não encontrada")).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Área pessoal" })).toBe(menu);

  act(() => window.history.back());
  await waitFor(() => expect(window.location.pathname).toBe("/encomendas"));
  expectPage("As minhas encomendas", "As minhas encomendas");
  act(() => window.history.forward());
  await waitFor(() =>
    expect(window.location.pathname).toBe(`/encomendas/${orderId}`),
  );
  expectPage("Detalhe da encomenda", "As minhas encomendas");
});

test("Menu mobile abre e fecha com os estados acessíveis", () => {
  mockDesktopQuery(false);
  mount();
  const toggle = screen.getByRole("button", {
    name: "Abrir menu da área pessoal",
  });
  const menu = document.getElementById(toggle.getAttribute("aria-controls")!)!;
  expect(menu.hidden).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(menu.hidden).toBe(false);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(toggle);
  expect(menu.hidden).toBe(true);
});
