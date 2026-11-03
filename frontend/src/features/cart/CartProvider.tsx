import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../../api/client";
import type { ProductDetail } from "../products/product";
import { useAuth } from "../auth/useAuth";
import { cartStorageKey, lineTotal, readCart, validProduct } from "./cart";
import {
  quantityToAdd,
  validPurchaseQuantity,
} from "../products/purchaseQuantity";
import { CartContext } from "./cartContext";

export default function CartProvider({ children }: { children: ReactNode }) {
  const { utilizador, estado } = useAuth();
  const [linhas, setLines] = useState(readCart);
  const linesRef = useRef(linhas);
  const [message, setMessage] = useState("");
  const [confirmadas, confirmar] = useState<string[]>([]);
  const owner = useRef<string | null>(null);
  const generation = useRef(0);
  const adding = useRef(new Set<string>());
  const canBuy =
    estado === "anonimo" ||
    (estado === "autenticado" && utilizador?.papel === "comprador");
  useEffect(() => {
    linesRef.current = linhas;
  }, [linhas]);

  useEffect(() => {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(linhas));
    } catch {
      /* Funciona em memória. */
    }
  }, [linhas]);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      setLines([]);
      confirmar([]);
      setMessage("");
      owner.current = null;
    };
    window.addEventListener("campo-mesa-logout", clear);
    return () => window.removeEventListener("campo-mesa-logout", clear);
  }, []);
  useEffect(() => {
    if (estado !== "autenticado" || !utilizador) return;
    if (
      (owner.current && owner.current !== utilizador.id) ||
      utilizador.papel !== "comprador"
    ) {
      generation.current++;
      setLines([]);
      confirmar([]);
      setMessage("");
    }
    owner.current = utilizador.id;
  }, [estado, utilizador]);

  async function adicionar(id: string, requested?: number) {
    if (!canBuy || adding.current.has(id)) return;
    adding.current.add(id);
    setMessage("");
    const currentGeneration = generation.current;
    try {
      const product = await api<ProductDetail>(`/products/${id}`);
      if (generation.current !== currentGeneration) return;
      if (!validProduct(product)) throw new Error("Produto indisponível.");
      const previous =
        linesRef.current.find((line) => line.produto._id === id)?.quantidade ??
        0;
      const quantidade = quantityToAdd(
        product.unidade,
        product.stock,
        previous,
        requested,
      );
      if (
        !Number.isSafeInteger(
          Math.round(product.preco * (previous + quantidade)),
        )
      )
        throw new Error("Quantidade demasiado elevada.");
      setLines((current) => {
        const existing = current.find((line) => line.produto._id === id);
        if (
          !validPurchaseQuantity(
            (existing?.quantidade ?? 0) + quantidade,
            product.unidade,
            product.stock,
          )
        )
          return current;
        if (existing)
          return current.map((line) =>
            line.produto._id === id
              ? {
                  produto: product,
                  quantidade: line.quantidade + quantidade,
                }
              : line,
          );
        return [...current, { produto: product, quantidade }];
      });
      setMessage(`${product.nome} adicionado ao carrinho.`);
    } catch (error) {
      if (generation.current === currentGeneration)
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível adicionar o produto.",
        );
    } finally {
      adding.current.delete(id);
    }
  }
  return (
    <CartContext.Provider
      value={{
        linhas,
        message,
        canBuy,
        adicionar,
        alterar: (id, quantidade) =>
          setLines((current) =>
            current.map((line) =>
              line.produto._id === id &&
              validPurchaseQuantity(
                quantidade,
                line.produto.unidade,
                line.produto.stock,
              ) &&
              Number.isSafeInteger(lineTotal({ ...line, quantidade }))
                ? { ...line, quantidade }
                : line,
            ),
          ),
        remover: (id) =>
          setLines((current) =>
            current.filter((line) => line.produto._id !== id),
          ),
        atualizarProdutos: (products) =>
          setLines((current) =>
            current.map((line) => ({
              ...line,
              produto:
                products.find((p) => p._id === line.produto._id) ??
                line.produto,
            })),
          ),
        esvaziar: () => {
          setLines([]);
          setMessage("");
        },
        confirmadas,
        confirmar,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
