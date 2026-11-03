import type { ProductDetail } from "../products/product";

export interface CartLine {
  produto: ProductDetail;
  quantidade: number;
}
export const cartStorageKey = "campo-mesa-carrinho";
export const validQuantity = (value: number) =>
  Number.isFinite(value) && value > 0;
export const lineTotal = (line: CartLine) =>
  Math.round(line.produto.preco * line.quantidade);
export const cartTotal = (lines: CartLine[]) =>
  lines.reduce((sum, line) => sum + lineTotal(line), 0);

export function validProduct(value: unknown): value is ProductDetail {
  if (!value || typeof value !== "object") return false;
  const p = value as ProductDetail;
  return (
    typeof p._id === "string" &&
    /^[a-f\d]{24}$/i.test(p._id) &&
    typeof p.nome === "string" &&
    Number.isSafeInteger(p.preco) &&
    p.preco >= 0 &&
    Number.isFinite(p.stock) &&
    p.stock >= 0 &&
    ["kg", "g", "l", "unidade"].includes(p.unidade) &&
    typeof p.produtorId?._id === "string" &&
    /^[a-f\d]{24}$/i.test(p.produtorId._id) &&
    typeof p.produtorId.nome === "string"
  );
}

export function readCart(): CartLine[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(cartStorageKey) || "[]",
    );
    if (!Array.isArray(value)) return [];
    const lines: CartLine[] = [];
    for (const line of value) {
      if (
        !line ||
        !validProduct(line.produto) ||
        !validQuantity(line.quantidade)
      )
        continue;
      const existing = lines.find(
        (item) => item.produto._id === line.produto._id,
      );
      if (existing) existing.quantidade += line.quantidade;
      else lines.push({ produto: line.produto, quantidade: line.quantidade });
    }
    return lines.filter(
      (line) =>
        validQuantity(line.quantidade) && Number.isSafeInteger(lineTotal(line)),
    );
  } catch {
    return [];
  }
}

export function groupCart(lines: CartLine[]) {
  const groups = new Map<
    string,
    { produtor: ProductDetail["produtorId"]; linhas: CartLine[] }
  >();
  for (const line of lines) {
    const producer = line.produto.produtorId;
    if (!groups.has(producer._id))
      groups.set(producer._id, { produtor: producer, linhas: [] });
    groups.get(producer._id)!.linhas.push(line);
  }
  return [...groups.values()];
}
