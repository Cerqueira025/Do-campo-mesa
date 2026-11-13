import type { ProducerProduct } from "../products/management";
import { validPurchaseQuantity } from "../products/purchaseQuantity.ts";
import { parseBid } from "./auction.ts";

export interface AuctionDraft {
  produtos: { key: number; produtoId: string; quantidade: string }[];
  lote: string;
  precoBase: string;
  incremento: string;
  inicio: "agora" | "agendado";
  dataInicio: string;
  dataFim: string;
}

export function eligibleAuctionProducts(products: ProducerProduct[]) {
  return products.filter(
    (product) => product.publicado && !product.bloqueado && product.stock > 0,
  );
}

export function auctionDateErrors(draft: AuctionDraft, now = Date.now()) {
  const start = draft.inicio === "agora" ? now : new Date(draft.dataInicio).getTime();
  const end = new Date(draft.dataFim).getTime();
  return {
    dataInicio: draft.inicio === "agendado" && (!Number.isFinite(start) || start <= now)
      ? "Escolha uma data e hora de início futura." : "",
    dataFim: !Number.isFinite(end) || end <= now
      ? "Escolha uma data e hora de fim futura."
      : Number.isFinite(start) && end <= start ? "O fim deve ser posterior ao início do leilão." : "",
  };
}

export function auctionPayload(
  draft: AuctionDraft,
  products: ProducerProduct[],
  now = Date.now(),
) {
  if (!draft.lote.trim()) throw new Error("Preencha a descrição do lote.");
  if (!draft.produtos.length)
    throw new Error("Adicione pelo menos um produto ao lote.");
  const byId = new Map(
    eligibleAuctionProducts(products).map((p) => [p._id, p]),
  );
  const ids = new Set<string>();
  const produtos = draft.produtos.map((line) => {
    const product = byId.get(line.produtoId);
    if (!product)
      throw new Error("Selecione um produto disponível em cada linha.");
    if (ids.has(product._id))
      throw new Error("Os produtos do lote não podem repetir-se.");
    ids.add(product._id);
    const text = line.quantidade.trim().replace(",", ".");
    const quantidade = Number(text);
    if (
      !/^\d+(?:\.\d+)?$/.test(text) ||
      !validPurchaseQuantity(quantidade, product.unidade, product.stock)
    )
      throw new Error(
        `Indique uma quantidade válida para ${product.nome}, dentro do stock disponível.`,
      );
    return { produtoId: product._id, quantidade };
  });
  const precoBase = /^0+(?:[,.]0{1,2})?$/.test(draft.precoBase.trim())
    ? 0
    : parseBid(draft.precoBase);
  const incremento = parseBid(draft.incremento);
  if (
    precoBase === null ||
    incremento === null ||
    !Number.isSafeInteger(precoBase + incremento)
  )
    throw new Error(
      "Indique um preço base não negativo e um incremento positivo, com até duas casas decimais e dentro do limite permitido.",
    );
  const start =
    draft.inicio === "agora" ? new Date(now) : new Date(draft.dataInicio);
  const end = new Date(draft.dataFim);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    (draft.inicio === "agendado" && start.getTime() <= now) ||
    end.getTime() <= now ||
    end <= start
  )
    throw new Error(
      "Indique um início futuro para agendar e um fim futuro, posterior ao início.",
    );
  return {
    produtos,
    lote: draft.lote.trim(),
    precoBase,
    incremento,
    dataInicio: start.toISOString(),
    dataFim: end.toISOString(),
  };
}
