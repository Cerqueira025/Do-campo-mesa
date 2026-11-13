import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import AdminPage from "../src/features/admin/AdminPage";
import AdminSummary from "../src/features/admin/AdminSummary";
import DecisionPanel from "../src/features/admin/DecisionPanel";
import { useAdminData } from "../src/features/admin/useAdminData";
import { AuthContext } from "../src/features/auth/authContext";
import { ApiError } from "../src/api/client";
import { authValue, product } from "./fixtures";

vi.mock("../src/features/cart/cartContext", () => ({
  useCart: () => ({ canBuy: false }),
}));

const summary = {
  users: { comprador: 11, produtor: 10, administrador: 1 },
  orders: { pendente: 6, entregue: 14 },
  pendingProducers: 0,
  activeAuctions: 1,
  reportedReviews: 8,
};
const administrator = {
  id: "admin",
  nome: "Administrador",
  email: "admin@example.test",
  papel: "administrador",
} as const;
const item = {
  ...product,
  createdAt: "2026-11-01T12:00:00Z",
  publicado: true,
  bloqueado: false,
  visivel: true,
};

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => vi.useRealTimers());

function provider(request: ReturnType<typeof vi.fn>) {
  const value = authValue({ utilizador: administrator, request });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
  };
}
function mount(
  path: string,
  request = vi.fn().mockResolvedValue({
    items: [item],
    total: 25,
    page: 1,
    limit: 24,
    categorias: ["Hortícolas"],
  }),
) {
  window.history.replaceState(null, "", path);
  render(<AdminPage />, { wrapper: provider(request) });
  return request;
}

test("Resumo prioriza tarefas, usa contagens reais e mantém navegação fora do conteúdo", async () => {
  mount(
    "/admin",
    vi.fn(async (path: string) =>
      path === "/admin/summary"
        ? summary
        : { items: [], total: 0, page: 1, limit: 24 },
    ),
  );
  await screen.findByRole("heading", { name: "Ações pendentes" });
  const main = screen.getByRole("main");
  const menu = screen.getByRole("navigation", { name: "Administração" });
  expect(main.contains(menu)).toBe(false);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByText("Sem pedidos pendentes")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Rever avaliações" }).getAttribute("href"),
  ).toBe("/admin/avaliacoes?estado=denunciada");
  expect(
    screen.getByRole("link", { name: /Compradores 11/ }).getAttribute("href"),
  ).toBe("/admin/utilizadores?papel=comprador");
  expect(within(menu).getByText("Moderação")).toBeTruthy();
  expect(
    within(menu).getByRole("link", {
      name: /Serviços e sistema Backoffice técnico/,
    }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Fechar menu administrativo" }),
  );
  try {
    expect(menu.hidden).toBe(true);
    fireEvent.click(
      within(main).getByRole("link", { name: /Ver utilizadores/ }),
    );
    expect(
      within(main).getByRole("heading", { name: "Utilizadores", level: 1 }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Abrir menu administrativo" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  } finally {
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir menu administrativo" }),
    );
  }
});

test("Resumo vazio mantém atalhos secundários e permite recuperar de uma falha inicial", async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("Sem rede"))
    .mockResolvedValue({ ...summary, reportedReviews: 0 });
  render(<AdminSummary />, { wrapper: provider(request) });
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Sem avaliações por rever");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: /Consultar avaliações/ })
      .getAttribute("href"),
  ).toContain("estado=denunciada");
});

test("Filtros, paginação e regresso do detalhe preservam a consulta; limpeza remove critérios opcionais", async () => {
  const request = vi.fn(async (path: string) =>
    path.includes(`/products/${item._id}`)
      ? item
      : {
          items: [item],
          total: 25,
          page: path.includes("page=2") ? 2 : 1,
          limit: 24,
          categorias: ["Hortícolas"],
        },
  );
  mount("/admin/produtos?categoria=Hort%C3%ADcolas&q=batata", request);
  const table = await screen.findByRole("table", { name: "Produtos" });
  expect(
    within(table).getByRole("columnheader", {
      name: "Publicação e visibilidade",
    }),
  ).toBeTruthy();
  expect(within(table).getByText("Stock: 5 kg")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Seguinte" }));
  await waitFor(() => expect(window.location.search).toContain("page=2"));
  await waitFor(() => expect(screen.getByText("Página 2 de 2")).toBeTruthy());
  fireEvent.click(
    within(screen.getByRole("table")).getByRole("link", { name: "Batata" }),
  );
  await screen.findByRole("heading", { name: "Decisão administrativa" });
  fireEvent.click(screen.getByRole("link", { name: /Voltar à lista/ }));
  await screen.findByRole("table");
  expect(new URLSearchParams(window.location.search).get("q")).toBe("batata");
  expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
  fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await waitFor(() => expect(window.location.search).toBe(""));
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
});

test("Limpeza mantém produtores pendentes e em leilões seleciona todos os estados", async () => {
  const request = mount("/admin/produtores?q=quinta");
  await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await waitFor(() => expect(window.location.search).toBe(""));
  await waitFor(() =>
    expect(request.mock.calls.at(-1)?.[0]).toContain(
      "papel=produtor&validacao=pendente",
    ),
  );
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Administração" })).getByRole(
      "link",
      { name: "Leilões" },
    ),
  );
  await screen.findByRole("heading", { name: "Leilões", level: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await waitFor(() => expect(window.location.search).toBe("?estado="));
  await waitFor(() =>
    expect(request.mock.calls.at(-1)?.[0]).toContain("estado=&page=1"),
  );
});

test("Listas vazias distinguem ausência de registos e pesquisa sem resultados", async () => {
  mount(
    "/admin/produtos?q=inexistente",
    vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 24 }),
  );
  await screen.findByRole("heading", { name: "Sem resultados" });
  fireEvent.click(
    within(screen.getByText("Sem resultados").parentElement!).getByRole(
      "button",
      { name: "Limpar filtros" },
    ),
  );
  await screen.findByRole("heading", { name: "Sem registos" });
});

test("Atualização automática conserva dados anteriores, recupera e remove-os quando perde acesso", async () => {
  vi.useFakeTimers();
  const request = vi
    .fn()
    .mockResolvedValueOnce(summary)
    .mockRejectedValueOnce(new Error("Sem rede"))
    .mockResolvedValueOnce({ ...summary, reportedReviews: 0 })
    .mockRejectedValueOnce(new ApiError(403, "Sem acesso"));
  const { result, unmount } = renderHook(
    () => useAdminData<typeof summary>("/admin/summary", true),
    { wrapper: provider(request) },
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(result.current.data?.reportedReviews).toBe(8);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(result.current.data?.reportedReviews).toBe(8);
  expect(result.current.error).toBe("Sem rede");
  await act(async () => result.current.refresh());
  expect(result.current.data?.reportedReviews).toBe(0);
  expect(result.current.error).toBe("");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(result.current.data).toBeNull();
  expect(result.current.error).toBe("Sem acesso");
  unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(request).toHaveBeenCalledTimes(4);
});

test("Decisões exigem motivo, preservam foco e impedem submissões duplicadas", async () => {
  let resolve!: () => void;
  const request = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const onSaved = vi.fn();
  render(
    <DecisionPanel
      item={item}
      path={`/admin/products/${item._id}/moderacao`}
      actions={[
        { label: "Ocultar produto", body: { bloqueado: true }, reason: true },
      ]}
      onSaved={onSaved}
    />,
    { wrapper: provider(request) },
  );
  const start = screen.getByRole("button", { name: "Ocultar produto" });
  fireEvent.click(start);
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: /confirmar decisão/ }),
  );
  expect(
    (screen.getByRole("button", { name: "Confirmar" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  const resumed = screen.getByRole("button", { name: "Ocultar produto" });
  expect(document.activeElement).toBe(resumed);
  fireEvent.click(resumed);
  fireEvent.change(screen.getByLabelText("Motivo (obrigatório)"), {
    target: { value: "  Conteúdo impróprio  " },
  });
  const form = screen
    .getByRole("button", { name: "Confirmar" })
    .closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(request).toHaveBeenCalledOnce();
  expect(request.mock.calls[0]).toEqual([
    `/admin/products/${item._id}/moderacao`,
    {
      method: "PATCH",
      body: {
        bloqueado: true,
        motivo: "Conteúdo impróprio",
        decisaoAnterior: null,
      },
    },
  ]);
  await act(async () => resolve());
  expect(onSaved).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toBe("Decisão guardada.");
});

test("Conflito de decisão mantém o aviso e pede dados atuais", async () => {
  const request = vi
    .fn()
    .mockRejectedValue(new ApiError(409, "Outra decisão já foi guardada."));
  const onSaved = vi.fn();
  render(
    <DecisionPanel
      item={{ ...item, estado: "denunciada", updatedAt: item.createdAt }}
      path={`/reviews/${item._id}/moderacao`}
      actions={[
        {
          label: "Republicar avaliação",
          body: { estado: "publicada" },
          reason: false,
        },
      ]}
      onSaved={onSaved}
    />,
    { wrapper: provider(request) },
  );
  fireEvent.click(screen.getByRole("button", { name: "Republicar avaliação" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(screen.getByRole("alert").textContent).toContain("Outra decisão");
  expect(request.mock.calls[0][1].body.atualizadoEm).toBe(item.createdAt);
});

test("Resumo mostra carregamento e identifica valores anteriores durante uma falha temporária", async () => {
  vi.useFakeTimers();
  const request = vi
    .fn()
    .mockResolvedValueOnce(summary)
    .mockRejectedValueOnce(new Error("Sem rede"));
  render(<AdminSummary />, { wrapper: provider(request) });
  expect(screen.getByText("A carregar resumo…")).toBeTruthy();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(screen.getByRole("alert").textContent).toContain(
    "A mostrar os dados anteriores.",
  );
  expect(screen.getByRole("link", { name: "Rever avaliações" })).toBeTruthy();
});

test("Avaliações conservam estado, classificação, denúncias e última decisão junto do acesso à moderação", async () => {
  mount(
    "/admin/avaliacoes?estado=denunciada",
    vi.fn().mockResolvedValue({
      items: [
        {
          ...item,
          nome: undefined,
          estado: "denunciada",
          classificacao: 3,
          comentario: "Rever este comentário",
          totalDenuncias: 2,
          autorId: { _id: "autor", nome: "Ana" },
          ultimaDecisao: {
            administradorId: null,
            data: item.createdAt,
            motivo: "Rever o contexto",
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 24,
    }),
  );
  const heading = await screen.findByRole("heading", {
    name: "Avaliação de Ana",
  });
  const card = within(heading.closest("li")!);
  expect(screen.queryByRole("table")).toBeNull();
  expect(card.getByText("Denunciada")).toBeTruthy();
  expect(card.getByText("3/5")).toBeTruthy();
  expect(card.getByText("Rever este comentário")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Última decisão" })).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Consultar e moderar" })
      .getAttribute("href"),
  ).toContain("regresso=");
});
