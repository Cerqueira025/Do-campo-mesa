import Auction from "../models/Auction.js";
import { auctionState } from "../domain/auction.js";

export const publicProduct = {
  path: "produtos.produtoId",
  match: { publicado: true, bloqueado: { $ne: true } },
};
export const publicProducer = {
  path: "produtorId",
  match: { papel: "produtor", "perfilProdutor.validacao": "aceite" },
};

export function auctionProductsBelongTo(auction, producerId) {
  return Boolean(
    auction?.produtos?.length &&
    auction.produtos.every(
      (line) =>
        line.produtoId &&
        String(line.produtoId.produtorId) === String(producerId),
    ),
  );
}

export function publicAuction(auction, now) {
  if (
    !auction?.produtorId ||
    !auctionProductsBelongTo(auction, auction.produtorId._id)
  )
    return null;
  const produtos = auction.produtos.map((line) => {
    const product = { ...line.produtoId };
    delete product.produtorId;
    return { ...line, produtoId: product };
  });
  return { ...auction, produtos, estado: auctionState(auction, now) };
}

export async function findPublicAuction(id, now = Date.now()) {
  const auction = await Auction.findById(id)
    .populate({
      ...publicProduct,
      select: "nome descricao unidade fotografia produtorId",
    })
    .populate({
      ...publicProducer,
      select: "nome perfilProdutor.descricao perfilProdutor.localidade",
    })
    .lean();
  return publicAuction(auction, now);
}
