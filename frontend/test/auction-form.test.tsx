import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import AuctionForm from "../src/features/auctions/AuctionForm";
import AppRoutes from "../src/navigation/AppRoutes";
import AccountPage from "../src/pages/AccountPage";
import ProducerProducts from "../src/features/products/ProducerProducts";
import { AuthContext } from "../src/features/auth/authContext";
import { navigate } from "../src/navigation/navigation";
import type { ProducerProduct } from "../src/features/products/management";
import { authValue, product } from "./fixtures";

vi.mock("../src/components/layout/AppHeader", () => ({ default: () => null }));
vi.mock("../src/features/reviews/ProducerRating", () => ({
  default: () => null,
}));
vi.mock("../src/navigation/navigation", async (original) => ({
  ...(await original<typeof import("../src/navigation/navigation")>()),
  navigate: vi.fn(),
  restoreNavigation: vi.fn(),
}));

const potato: ProducerProduct = {
  ...product,
  publicado: true,
  bloqueado: false,
  createdAt: "",
  updatedAt: "",
};
const oil: ProducerProduct = {
  ...potato,
  _id: "dca000000000000000000066",
  nome: "Azeite",
  unidade: "l",
};
const producer = {
  id: "produtor",
  nome: "Produtor",
  email: "produtor@example.test",
  papel: "produtor",
  validacao: "aceite",
} as const;
const auctionId = "dca000000000000000004001";
const page = (items: ProducerProduct[], total = items.length) => ({
  items,
  page: 1,
  limit: 100,
  total,
});

beforeEach(() => {
  document.title = "Do campo à mesa";
  vi.mocked(navigate).mockClear();
});

async function form(items = [potato, oil]) {
  const request = vi.fn().mockResolvedValue(page(items));
  render(
    <AuthContext.Provider value={authValue({ utilizador: producer, request })}>
      <AuctionForm />
    </AuthContext.Provider>,
  );
  await screen.findByLabelText("Descrição do lote");
  return request;
}
function choose(name: string, label: string) {
  fireEvent.click(screen.getByRole("combobox", { name }));
  fireEvent.click(screen.getByRole("option", { name: label }));
}
function fill() {
  fireEvent.change(screen.getByLabelText("Descrição do lote"), {
    target: { value: "Cabaz da horta" },
  });
  choose("Produto 1", "Batata");
  fireEvent.change(screen.getByLabelText("Preço base do lote (€)"), {
    target: { value: "10,25" },
  });
  fireEvent.change(screen.getByLabelText("Incremento mínimo (€)"), {
    target: { value: "0.50" },
  });
  fireEvent.change(screen.getByLabelText("Data e hora de fim"), {
    target: { value: "2099-01-01T12:00" },
  });
}
const submit = () =>
  fireEvent.submit(
    screen.getByRole("button", { name: "Criar leilão" }).closest("form")!,
  );

test("Cria um lote com um produto e abre o detalhe, sem enviar campos de stock", async () => {
  const request = await form();
  fill();
  request.mockResolvedValue({ _id: auctionId });
  const before = Date.now();
  submit();
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(
      `/produtor/leiloes/${auctionId}?criado=1`,
    ),
  );
  const [path, options] = request.mock.calls.at(-1)!;
  expect(path).toBe("/auctions");
  expect(options.method).toBe("POST");
  expect(options.body).toMatchObject({
    produtos: [{ produtoId: potato._id, quantidade: 1 }],
    lote: "Cabaz da horta",
    precoBase: 1025,
    incremento: 50,
  });
  expect(Date.parse(options.body.dataInicio)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(options.body.dataInicio)).toBeLessThanOrEqual(Date.now());
  expect(Object.keys(options.body).sort()).toEqual(
    [
      "produtos",
      "lote",
      "precoBase",
      "incremento",
      "dataInicio",
      "dataFim",
    ].sort(),
  );
});

test("Adiciona um cabaz, impede escolhas repetidas e mantém o foco ao adicionar e remover", async () => {
  const request = await form();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Adicionar produto" }));
  const second = screen.getByRole("combobox", { name: "Produto 2" });
  expect(document.activeElement).toBe(second);
  fireEvent.click(second);
  expect(
    within(screen.getByRole("listbox")).queryByRole("option", {
      name: "Batata",
    }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("option", { name: "Azeite" }));
  fireEvent.change(screen.getByLabelText("Quantidade de Azeite (l)"), {
    target: { value: "0.5" },
  });
  expect(
    (
      screen.getByRole("button", {
        name: "Adicionar produto",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  request.mockResolvedValue({ _id: auctionId });
  submit();
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(request.mock.calls.at(-1)![1].body.produtos).toEqual([
    { produtoId: potato._id, quantidade: 1 },
    { produtoId: oil._id, quantidade: 0.5 },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Remover produto 1" }));
  expect(document.activeElement).toBe(
    screen.getByRole("combobox", { name: "Produto 1" }),
  );
  expect(screen.getByLabelText("Quantidade de Azeite (l)")).toBeTruthy();
});

test("Percorre a paginação e permite escolher um produto disponível só na página seguinte", async () => {
  const first = Array.from({ length: 100 }, (_, i) => ({
    ...potato,
    _id: `p${i}`,
    publicado: false,
  }));
  const request = vi
    .fn()
    .mockResolvedValueOnce(page(first, 101))
    .mockResolvedValueOnce(page([oil], 101));
  render(
    <AuthContext.Provider value={authValue({ request })}>
      <AuctionForm />
    </AuthContext.Provider>,
  );
  const select = await screen.findByRole("combobox", { name: "Produto 1" });
  expect(request.mock.calls.map((call) => call[0])).toEqual([
    "/products/mine?page=1&limit=100",
    "/products/mine?page=2&limit=100",
  ]);
  fireEvent.click(select);
  expect(screen.getByRole("option", { name: "Azeite" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Batata" })).toBeNull();
});

test("Apresenta estado vazio quando só existem produtos indisponíveis", async () => {
  const request = vi.fn().mockResolvedValue(
    page([
      { ...potato, publicado: false },
      { ...oil, bloqueado: true },
      { ...potato, stock: 0 },
    ]),
  );
  render(
    <AuthContext.Provider value={authValue({ request })}>
      <AuctionForm />
    </AuthContext.Provider>,
  );
  await screen.findByText(/Não tem produtos elegíveis/);
  expect(screen.queryByRole("button", { name: "Criar leilão" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Gerir produtos" }).getAttribute("href"),
  ).toBe("/produtor/produtos");
});

test("Uma falha numa página impede submeter dados parciais e permite repetir o carregamento", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(page([potato], 101))
    .mockRejectedValueOnce(new Error("Ligação interrompida"));
  render(
    <AuthContext.Provider value={authValue({ request })}>
      <AuctionForm />
    </AuthContext.Provider>,
  );
  await waitFor(() => {
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Ligação interrompida");
    expect(document.activeElement).toBe(alert);
  });
  expect(screen.queryByRole("button", { name: "Criar leilão" })).toBeNull();
  request.mockResolvedValue(page([potato]));
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByRole("button", { name: "Criar leilão" });
});

test("Conserva dados e foca o erro quando o servidor recusa; bloqueia pedidos duplicados", async () => {
  const request = await form();
  fill();
  let reject!: (error: Error) => void;
  request.mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const element = screen
    .getByRole("button", { name: "Criar leilão" })
    .closest("form")!;
  fireEvent.submit(element);
  fireEvent.submit(element);
  expect(
    request.mock.calls.filter((call) => call[0] === "/auctions"),
  ).toHaveLength(1);
  expect(
    screen.getByRole("button", { name: "A criar leilão…" }).closest("fieldset")!
      .disabled,
  ).toBe(true);
  await act(async () => reject(new Error("O stock já não é suficiente.")));
  expect(screen.getByRole("alert").textContent).toContain("stock");
  expect(document.activeElement).toBe(screen.getByRole("alert"));
  expect(
    (screen.getByLabelText("Descrição do lote") as HTMLTextAreaElement).value,
  ).toBe("Cabaz da horta");
  expect(screen.getByRole("combobox", { name: "Produto 1" }).textContent).toBe(
    "Batata",
  );
  expect(navigate).not.toHaveBeenCalled();
  request.mockResolvedValue({ _id: auctionId });
  submit();
  await waitFor(() => expect(navigate).toHaveBeenCalled());
});

test("Valida campos, stock e agendamento antes de enviar e aceita preço base zero", async () => {
  const request = await form();
  submit();
  expect(screen.getByRole("alert").textContent).toContain("descrição");
  expect(document.activeElement).toBe(screen.getByRole("alert"));
  fill();
  fireEvent.change(screen.getByLabelText("Quantidade de Batata (kg)"), {
    target: { value: "6" },
  });
  submit();
  expect(screen.getByRole("alert").textContent).toContain("stock");
  fireEvent.change(screen.getByLabelText("Quantidade de Batata (kg)"), {
    target: { value: "2" },
  });
  choose("Início do leilão", "Agendar");
  fireEvent.change(screen.getByLabelText("Data e hora de início"), {
    target: { value: "2000-01-01T12:00" },
  });
  submit();
  expect(screen.getByRole("alert").textContent).toContain("início futura");
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Data e hora de início"), {
    target: { value: "2099-01-01T11:00" },
  });
  fireEvent.change(screen.getByLabelText("Preço base do lote (€)"), {
    target: { value: "0" },
  });
  request.mockResolvedValue({ _id: auctionId });
  submit();
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(request.mock.calls.at(-1)![1].body).toMatchObject({
    precoBase: 0,
    dataInicio: new Date("2099-01-01T11:00").toISOString(),
  });
});

test("A rota exige login, papel de produtor e aprovação antes de carregar produtos", async () => {
  window.history.replaceState(null, "", "/produtor/leiloes/novo");
  const request = vi.fn().mockResolvedValue(page([potato]));
  const route = (overrides: Parameters<typeof authValue>[0]) => (
    <AuthContext.Provider value={authValue({ request, ...overrides })}>
      <AppRoutes />
    </AuthContext.Provider>
  );
  const view = render(route({ estado: "anonimo", utilizador: null }));
  expect(navigate).toHaveBeenCalledWith(
    "/login?regresso=%2Fprodutor%2Fleiloes%2Fnovo",
    { replace: true },
  );
  view.rerender(route({}));
  expect(screen.getByRole("heading", { name: "Sem permissão" })).toBeTruthy();
  for (const validacao of ["pendente", "rejeitado"] as const) {
    view.rerender(route({ utilizador: { ...producer, validacao } }));
    expect(screen.getByRole("heading", { name: "Sem permissão" })).toBeTruthy();
  }
  expect(request).not.toHaveBeenCalled();
  view.rerender(route({ utilizador: producer }));
  await screen.findByRole("button", { name: "Criar leilão" });
  expect(request).toHaveBeenCalledTimes(1);
});

test("A conta separa leilões da gestão dos produtos", async () => {
  const request = vi.fn().mockResolvedValue(page([]));
  const view = render(
    <AuthContext.Provider value={authValue({ utilizador: producer, request })}>
      <AccountPage />
    </AuthContext.Provider>,
  );
  expect(
    screen.getByRole("link", { name: "Os meus leilões" }).getAttribute("href"),
  ).toBe("/produtor/leiloes");
  view.rerender(
    <AuthContext.Provider value={authValue({ utilizador: producer, request })}>
      <ProducerProducts />
    </AuthContext.Provider>,
  );
  expect(screen.queryByRole("link", { name: "Novo leilão" })).toBeNull();
  await screen.findByText(/Ainda não tem produtos/);
});

test("Datas inválidas mostram erro junto ao campo e recebem foco", async () => {
  const request = await form();
  fill();
  const end = screen.getByLabelText("Data e hora de fim");
  fireEvent.change(end, { target: { value: "2000-01-01T12:00" } });
  submit();
  expect(
    screen.getByText("Escolha uma data e hora de fim futura."),
  ).toBeTruthy();
  expect(end.getAttribute("aria-invalid")).toBe("true");
  expect(end.getAttribute("aria-describedby")).toBe("auction-end-error");
  expect(document.activeElement).toBe(end);
  choose("Início do leilão", "Agendar");
  fireEvent.change(screen.getByLabelText("Data e hora de início"), {
    target: { value: "2099-01-01T15:00" },
  });
  fireEvent.change(end, { target: { value: "2099-01-01T14:00" } });
  submit();
  expect(
    screen.getByText("O fim deve ser posterior ao início do leilão."),
  ).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(1);
});
