export function productIdFromPath(path: string) {
  return /^\/produtos\/([a-f\d]{24})\/?$/i.exec(path)?.[1] ?? null;
}

export function auctionIdFromPath(path: string) {
  return /^\/leiloes\/([a-f\d]{24})\/?$/i.exec(path)?.[1] ?? null;
}

export function orderIdFromPath(path: string) {
  return /^\/encomendas\/([a-f\d]{24})\/?$/i.exec(path)?.[1] ?? null;
}
