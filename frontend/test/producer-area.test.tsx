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
import { navigate } from "../src/navigation/navigation";
import { AuthContext } from "../src/features/auth/authContext";
import { authValue, product } from "./fixtures";

vi.mock("../src/features/cart/cartContext", () => ({
  useCart: () => ({ canBuy: false, confirmadas: [], linhas: [] }),
}));
vi.mock("../src/features/reviews/ProducerRating", () => ({
  default: () => (
    <section>
      <h2>As suas avaliações</h2>
    </section>
  ),
}));

const producer = {
  id: "produtor",
  nome: "Produtor",
  email: "p@example.test",
  papel: "produtor",
  validacao: "aceite",
} as const;
const profile = {
  descricao: "Horta",
  localidade: "Viana",
  morada: "Rua da Horta",
  coordenadas: { latitude: 41, longitude: -8 },
};

beforeEach(() => {
  document.title = "Do campo à mesa";
  vi.stubGlobal("scrollTo", vi.fn());
});

function mount(
  path = "/conta",
  validacao: "aceite" | "pendente" | "rejeitado" = "aceite",
) {
  window.history.replaceState(null, "", path);
  const request = vi.fn(async (url: string) => {
    if (url === "/producers/me") return profile;
    if (url.startsWith("/products/mine?"))
      return { items: [], total: 0, page: 1, limit: 24 };
    if (url.startsWith("/products/mine/"))
      return { ...product, publicado: false, bloqueado: false };
    if (url.startsWith("/auctions/mine?"))
      return { items: [], total: 0, page: 1, limit: 24 };
    if (url === "/orders") return [];
    throw new Error("Pedido indisponível");
  });
  render(
    <AuthContext.Provider
      value={authValue({ utilizador: { ...producer, validacao }, request })}
    >
      <AppRoutes />
    </AuthContext.Provider>,
  );
  return request;
}

function selected(menu: HTMLElement, label: string) {
  expect(within(menu).getByRole("link", { current: "page" }).textContent).toBe(
    label,
  );
}

test("Secções e formulários mudam só o painel e preservam o menu e o cabeçalho", async () => {
  mount();
  const header = screen.getByRole("banner");
  const menu = screen.getByRole("navigation", { name: "Gerir exploração" });
  expect(screen.getByRole("main").contains(menu)).toBe(false);
  expect(within(menu).getAllByRole("link")).toHaveLength(7);
  for (const group of ["Gerir exploração", "Produtos", "Leilões"]) {
    expect(within(menu).getByText(group)).toBeTruthy();
  }
  const toggle = screen.getByRole("button", {
    name: "Fechar menu da exploração",
  });
  for (const [label, path, heading] of [
    ["Editar perfil da exploração", "/produtor/perfil", "Perfil da exploração"],
    ["Encomendas recebidas", "/produtor/encomendas", "Encomendas recebidas"],
    ["Os meus produtos", "/produtor/produtos", "Os meus produtos"],
    ["Os meus leilões", "/produtor/leiloes", "Os meus leilões"],
    ["Novo produto", "/produtor/produtos/novo", "Novo produto"],
    ["Novo leilão", "/produtor/leiloes/novo", "Novo leilão"],
    ["A minha conta", "/conta", "Dados da conta"],
  ]) {
    fireEvent.click(within(menu).getByRole("link", { name: label }));
    await screen.findByRole("heading", {
      name: heading,
      level: heading === "Dados da conta" ? 2 : 1,
    });
    expect(window.location.pathname).toBe(path);
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("navigation", { name: "Gerir exploração" })).toBe(
      menu,
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1 }),
    );
    if (
      label === "Editar perfil da exploração" ||
      label === "Encomendas recebidas"
    ) {
      expect(
        screen.queryByRole("heading", { name: heading, level: 2 }),
      ).toBeNull();
    }
    selected(
      menu,
      label === "Editar perfil da exploração" ? "Perfil da exploração" : label,
    );
  }
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  for (const [path, heading] of [
    ["/produtor/produtos/novo", "Novo produto"],
    [`/produtor/produtos/${product._id}/editar`, "Editar produto"],
    [`/encomendas/${product._id}`, "Detalhe da encomenda"],
  ]) {
    act(() => navigate(path));
    await screen.findByRole("heading", {
      name: heading,
      level: heading === "Dados da conta" ? 2 : 1,
    });
    expect(
      screen.getByRole("button", { name: "Abrir menu da exploração" }),
    ).toBe(toggle);
    expect(menu.hidden).toBe(true);
    expect(screen.getByRole("banner")).toBe(header);
  }
  fireEvent.click(toggle);
  selected(menu, "Encomendas recebidas");
  expect(screen.getAllByRole("main")).toHaveLength(1);
});

test("Acesso direto e histórico mantêm a seleção e a instância do layout", async () => {
  mount("/produtor/perfil");
  await screen.findByLabelText("Morada");
  const menu = screen.getByRole("navigation", { name: "Gerir exploração" });
  const header = screen.getByRole("banner");
  selected(menu, "Perfil da exploração");
  fireEvent.click(within(menu).getByRole("link", { name: "Os meus produtos" }));
  await screen.findByRole("heading", { name: "Os meus produtos", level: 1 });
  act(() => window.history.back());
  await waitFor(() =>
    expect(window.location.pathname).toBe("/produtor/perfil"),
  );
  await screen.findByLabelText("Morada");
  selected(menu, "Perfil da exploração");
  act(() => window.history.forward());
  await waitFor(() =>
    expect(window.location.pathname).toBe("/produtor/produtos"),
  );
  selected(menu, "Os meus produtos");
  expect(screen.getByRole("banner")).toBe(header);
  expect(screen.getByRole("navigation", { name: "Gerir exploração" })).toBe(
    menu,
  );
});

test.each(["pendente", "rejeitado"] as const)(
  "Produtor %s continua sem acesso à gestão restrita",
  async (validacao) => {
    const request = mount("/produtor/produtos", validacao);
    await screen.findByRole("heading", { name: "Sem permissão" });
    for (const path of [
      "/produtor/produtos/novo",
      "/produtor/leiloes",
      "/produtor/leiloes/novo",
    ]) {
      act(() => navigate(path));
      await screen.findByRole("heading", { name: "Sem permissão" });
    }
    expect(request).not.toHaveBeenCalled();
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(
      screen.queryByRole("navigation", { name: "Gerir exploração" }),
    ).toBeNull();
  },
);

test.each(["pendente", "rejeitado"] as const)(
  "Produtor %s mantém acesso ao perfil com menu limitado",
  async (validacao) => {
    mount("/produtor/perfil", validacao);
    await screen.findByLabelText("Morada");
    const open = screen.queryByRole("button", {
      name: "Abrir menu da exploração",
    });
    if (open) fireEvent.click(open);
    const menu = screen.getByRole("navigation", { name: "Gerir exploração" });
    expect(within(menu).getAllByRole("link")).toHaveLength(3);
    expect(
      within(menu).queryByRole("link", { name: "Os meus produtos" }),
    ).toBeNull();
    expect(
      within(menu).queryByRole("link", { name: "Os meus leilões" }),
    ).toBeNull();
    selected(menu, "Perfil da exploração");
  },
);

test("Conta de administrador mantém apresentação autónoma", () => {
  window.history.replaceState(null, "", "/conta");
  render(
    <AuthContext.Provider
      value={authValue({
        utilizador: {
          id: "administrador",
          nome: "Conta",
          email: "conta@example.test",
          papel: "administrador",
        },
      })}
    >
      <AppRoutes />
    </AuthContext.Provider>,
  );
  expect(
    screen.getByRole("heading", { name: "A minha conta", level: 1 }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("navigation", { name: "Gerir exploração" }),
  ).toBeNull();
  expect(
    within(screen.getByRole("main")).getByRole("link", {
      name: "Administração",
    }),
  ).toBeTruthy();
  expect(document.querySelector(".management-layout")).toBeNull();
});

test.each([
  ["/produtor/produtos/novo", "Novo produto"],
  ["/produtor/leiloes/novo", "Novo leilão"],
  [`/produtor/produtos/${product._id}`, "Os meus produtos"],
  [`/produtor/produtos/${product._id}/editar`, "Os meus produtos"],
  [`/produtor/leiloes/${product._id}`, "Os meus leilões"],
])("Acesso direto a %s seleciona apenas %s", async (path, label) => {
  mount(path);
  await screen.findByRole("heading", { level: 1 });
  const open = screen.queryByRole("button", {
    name: "Abrir menu da exploração",
  });
  if (open) fireEvent.click(open);
  selected(screen.getByRole("navigation", { name: "Gerir exploração" }), label);
});

test("Histórico entre listagem e criação conserva seleção e menu", async () => {
  mount("/produtor/produtos");
  const menu = screen.getByRole("navigation", { name: "Gerir exploração" });
  fireEvent.click(within(menu).getByRole("link", { name: "Novo produto" }));
  await screen.findByRole("heading", { level: 1, name: "Novo produto" });
  selected(menu, "Novo produto");
  act(() => window.history.back());
  await screen.findByRole("heading", { level: 1, name: "Os meus produtos" });
  selected(menu, "Os meus produtos");
  act(() => window.history.forward());
  await screen.findByRole("heading", { level: 1, name: "Novo produto" });
  selected(menu, "Novo produto");
  expect(screen.getByRole("navigation", { name: "Gerir exploração" })).toBe(
    menu,
  );
});
