import { vi } from "vitest";
import type { AuthContextValue } from "../src/features/auth/authContext";
import type { ProductDetail } from "../src/features/products/product";

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
