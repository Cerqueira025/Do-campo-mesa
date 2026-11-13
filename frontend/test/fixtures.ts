import { vi } from "vitest";
import type { AuthContextValue } from "../src/features/auth/authContext";
import type { ProductDetail } from "../src/features/products/product";

export function mockDesktopQuery(initial = true) {
  const listeners = new Set<() => void>();
  const query = {
    matches: initial,
    media: "(min-width: 1024px)",
    addEventListener: vi.fn((_event: string, listener: () => void) =>
      listeners.add(listener),
    ),
    removeEventListener: vi.fn((_event: string, listener: () => void) =>
      listeners.delete(listener),
    ),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
  return {
    query,
    resize(desktop: boolean) {
      query.matches = desktop;
      listeners.forEach((listener) => listener());
    },
  };
}

export const product: ProductDetail = {
  _id: "dca000000000000000000065",
  nome: "Batata",
  categoria: "Hortícolas",
  preco: 150,
  unidade: "kg",
  stock: 5,
  descricao: "Batata local",
  epoca: [],
  biologico: false,
  produtorId: { _id: "dca000000000000000000004", nome: "Produtor" },
};

export function authValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    token: "token",
    utilizador: {
      id: "comprador",
      nome: "Maria",
      email: "maria@example.test",
      papel: "comprador",
    },
    estado: "autenticado",
    erro: "",
    entrar: vi.fn(),
    sair: vi.fn(),
    atualizar: vi.fn(),
    request: vi.fn(),
    ...overrides,
  };
}
