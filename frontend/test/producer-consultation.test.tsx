import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import ProducerProductDetail from "../src/features/products/ProducerProductDetail";
import ProducerAuctions from "../src/features/auctions/ProducerAuctions";
import { AuthContext } from "../src/features/auth/authContext";
import { authValue, product } from "./fixtures";
import { navigate } from "../src/navigation/navigation";

vi.mock("../src/navigation/navigation", () => ({
  navigate: vi.fn(),
  restoreNavigation: vi.fn(),
}));
beforeEach(() => {
  window.history.replaceState(null, "", "/produtor/leiloes");
  vi.mocked(navigate).mockClear();
});

test("Consulta produto despublicado e bloqueado com acesso à edição", async () => {
  const request = vi.fn().mockResolvedValue({
    ...product,
    publicado: false,
    bloqueado: true,
    dataValidade: null,
  });
  render(
    <AuthContext.Provider value={authValue({ request })}>
      <ProducerProductDetail id={product._id} />
    </AuthContext.Provider>,
  );
  await screen.findByRole("heading", { name: product.nome });
  expect(screen.getByText("Despublicado")).toBeTruthy();
  expect(screen.getByText("Bloqueado")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Editar produto" }).getAttribute("href"),
  ).toBe(`/produtor/produtos/${product._id}/editar`);
  expect(request.mock.calls[0][0]).toBe(`/products/mine/${product._id}`);
});

const auction = {
  _id: product._id,
  lote: "Cabaz de verão",
  precoBase: 500,
  incremento: 100,
  produtos: [
    {
      produtoId: { _id: product._id, nome: product.nome },
      quantidade: 2,
      unidade: "kg",
    },
  ],
  estado: "cancelado",
  reservaStock: "sem-reserva",
  motivoCancelamento: "produto-indisponivel",
  visivel: true,
  dataInicio: "2026-11-01T10:00:00Z",
  dataFim: "2026-11-04T10:00:00Z",
  licitacaoAtual: { valor: 600 },
};

test("Lista leilões, consulta detalhes e permite paginar", async () => {
  const request = vi
    .fn()
    .mockResolvedValue({ items: [auction], page: 1, limit: 24, total: 25 });
  render(
    <AuthContext.Provider value={authValue({ request })}>
      <ProducerAuctions />
    </AuthContext.Provider>,
  );
  await screen.findByRole("heading", { name: auction.lote });
  expect(screen.getByText("Cancelado")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: `Consultar leilão ${auction.lote}` })
      .getAttribute("href"),
  ).toBe(`/produtor/leiloes/${auction._id}`);
  fireEvent.click(screen.getByRole("button", { name: "Seguinte" }));
  expect(navigate).toHaveBeenCalledWith("/produtor/leiloes?page=2");
});

test("Detalhe privado mostra motivo de cancelamento e valores", async () => {
  const request = vi.fn(async (url: string) =>
    url.includes("/bids?")
      ? { items: [], page: 1, limit: 24, total: 0 }
      : auction,
  );
  render(
    <AuthContext.Provider value={authValue({ request })}>
      <ProducerAuctions id={auction._id} />
    </AuthContext.Provider>,
  );
  await screen.findByRole("heading", { name: auction.lote });
  expect(screen.getByText("Preço base")).toBeTruthy();
  expect(
    screen.getByText(/Um dos produtos do lote já não está disponível/),
  ).toBeTruthy();
  await screen.findByText("Ainda não há licitações para este leilão.");
});

test("Histórico pagina as licitações e permite repetir uma falha sem perder o resumo", async () => {
  const createdAt = "2026-11-02T09:15:00.000Z";
  const request = vi
    .fn()
    .mockResolvedValueOnce(auction)
    .mockRejectedValueOnce(new Error("Histórico indisponível"))
    .mockResolvedValueOnce({
      items: [{ _id: "1", valor: 600, createdAt, nome: "Ana" }],
      page: 1,
      limit: 1,
      total: 2,
    })
    .mockResolvedValueOnce({
      items: [{ _id: "2", valor: 500, createdAt, nome: "Comprador" }],
      page: 2,
      limit: 1,
      total: 2,
    });
  render(
    <AuthContext.Provider value={authValue({ request })}>
      <ProducerAuctions id={auction._id} />
    </AuthContext.Provider>,
  );
  const history = await screen.findByRole("region", {
    name: "Histórico de licitações",
  });
  await within(history).findByText("Histórico indisponível");
  expect(screen.getByRole("heading", { name: auction.lote })).toBeTruthy();
  fireEvent.click(
    within(history).getByRole("button", { name: "Tentar novamente" }),
  );
  const first = await within(history).findByRole("cell", {
    name: /^6,00\s€$/,
  });
  expect(first.closest("tr")?.querySelector("time")?.dateTime).toBe(createdAt);
  expect(within(history).getByRole("cell", { name: "Ana" })).toBeTruthy();
  fireEvent.click(within(history).getByRole("button", { name: "Seguinte" }));
  await within(history).findByRole("cell", { name: /^5,00\s€$/ });
  expect(request.mock.calls.at(-1)?.[0]).toBe(
    `/auctions/mine/${auction._id}/bids?page=2`,
  );
});

test("Falha de consulta permite repetir sem perder o percurso", async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("Sem ligação"))
    .mockResolvedValue({ items: [], page: 1, limit: 24, total: 0 });
  render(
    <AuthContext.Provider value={authValue({ request })}>
      <ProducerAuctions />
    </AuthContext.Provider>,
  );
  await screen.findByText("Sem ligação");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText(/Ainda não tem leilões/);
});
