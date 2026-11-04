import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import ProducerProductDetail from "../src/features/products/ProducerProductDetail";
import ProducerAuctions from "../src/features/auctions/ProducerAuctions";
import { AuthContext } from "../src/features/auth/authContext";
import { authValue, product } from "./fixtures";
import { navigate } from "../src/navigation/navigation";

vi.mock("../src/navigation/navigation", () => ({ navigate: vi.fn(), restoreNavigation: vi.fn() }));
beforeEach(() => {
  window.history.replaceState(null, "", "/produtor/leiloes");
  vi.mocked(navigate).mockClear();
});

test("Consulta produto despublicado e bloqueado com acesso à edição", async () => {
  const request = vi.fn().mockResolvedValue({ ...product, publicado: false, bloqueado: true, dataValidade: null });
  render(<AuthContext.Provider value={authValue({ request })}><ProducerProductDetail id={product._id} /></AuthContext.Provider>);
  await screen.findByRole("heading", { name: product.nome });
  expect(screen.getByText("Despublicado")).toBeTruthy();
  expect(screen.getByText("Bloqueado")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Editar produto" }).getAttribute("href")).toBe(`/produtor/produtos/${product._id}/editar`);
  expect(request.mock.calls[0][0]).toBe(`/products/mine/${product._id}`);
});

const auction = {
  _id: product._id, lote: "Cabaz de verão", precoBase: 500, incremento: 100,
  produtos: [{ produtoId: { _id: product._id, nome: product.nome }, quantidade: 2, unidade: "kg" }],
  estado: "cancelado", reservaStock: "sem-reserva", motivoCancelamento: "produto-indisponivel",
  dataInicio: "2026-11-01T10:00:00Z", dataFim: "2026-11-04T10:00:00Z", licitacaoAtual: { valor: 600 },
};

test("Lista leilões, consulta detalhes e permite paginar", async () => {
  const request = vi.fn().mockResolvedValue({ items: [auction], page: 1, limit: 24, total: 25 });
  render(<AuthContext.Provider value={authValue({ request })}><ProducerAuctions /></AuthContext.Provider>);
  await screen.findByRole("heading", { name: auction.lote });
  expect(screen.getByText("Cancelado")).toBeTruthy();
  expect(screen.getByRole("link", { name: `Consultar leilão ${auction.lote}` }).getAttribute("href")).toBe(`/produtor/leiloes/${auction._id}`);
  fireEvent.click(screen.getByRole("button", { name: "Seguinte" }));
  expect(navigate).toHaveBeenCalledWith("/produtor/leiloes?page=2");
});

test("Detalhe privado mostra motivo de cancelamento e valores", async () => {
  const request = vi.fn().mockResolvedValue(auction);
  render(<AuthContext.Provider value={authValue({ request })}><ProducerAuctions id={auction._id} /></AuthContext.Provider>);
  await screen.findByRole("heading", { name: auction.lote });
  expect(screen.getByText("Preço base")).toBeTruthy();
  expect(screen.getByText(/Um dos produtos do lote já não está disponível/)).toBeTruthy();
});

test("Falha de consulta permite repetir sem perder o percurso", async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error("Sem ligação")).mockResolvedValue({ items: [], page: 1, limit: 24, total: 0 });
  render(<AuthContext.Provider value={authValue({ request })}><ProducerAuctions /></AuthContext.Provider>);
  await screen.findByText("Sem ligação");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText(/Ainda não tem leilões/);
});
