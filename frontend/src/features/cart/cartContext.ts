import { createContext, useContext } from "react";
import type { ProductDetail } from "../products/product";
import type { CartLine } from "./cart";

export interface CartContextValue {
  linhas: CartLine[];
  message: string;
  canBuy: boolean;
  adicionar: (id: string, quantidade?: number) => Promise<void>;
  alterar: (id: string, quantidade: number) => void;
  remover: (id: string) => void;
  atualizarProdutos: (products: ProductDetail[]) => void;
  esvaziar: () => void;
  confirmadas: string[];
  confirmar: (ids: string[]) => void;
}
export const CartContext = createContext<CartContextValue | null>(null);
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("Carrinho indisponível");
  return value;
}
