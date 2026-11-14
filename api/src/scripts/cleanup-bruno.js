import { User, Product, Order, Auction, Bid, Review } from "../models/index.js";
import mongoose from "mongoose";
import { productPhotos } from "../services/productPhotos.js";

const testUserEmail = /^bruno-test-[0-9]+-[a-z0-9]+@example\.test$/;
const testMarker = /^BRUNO_AUTOTEST_/;

export async function cleanupBrunoAuction(id) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const auction = await Auction.findOne({ _id: id, lote: testMarker })
        .session(session)
        .lean();
      if (!auction) return;
      const removed = await Auction.deleteOne(
        { _id: id, reservaStock: auction.reservaStock },
        { session },
      );
      if (removed.deletedCount !== 1) return;
      if (["reservada", "atribuida"].includes(auction.reservaStock)) {
        for (const line of auction.produtos) {
          const result = await Product.updateOne(
            { _id: line.produtoId },
            { $inc: { stock: line.quantidade } },
            { session },
          );
          if (result.matchedCount !== 1)
            throw new Error("Produto reservado de teste não encontrado.");
        }
      }
      await Bid.deleteMany({ leilaoId: id }, { session });
    });
  } finally {
    await session.endSession();
  }
}

export async function cleanupBrunoOrder(id, userIds) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOneAndDelete(
        { _id: id, compradorId: { $in: userIds }, leilaoId: null },
        { session },
      );
      if (!order) return;
      for (const line of order.linhas) {
        const result = await Product.updateOne(
          { _id: line.produtoId },
          { $inc: { stock: line.quantidade } },
          { session },
        );
        if (result.matchedCount !== 1)
          throw new Error("Produto de encomenda de teste não encontrado.");
      }
    });
  } finally {
    await session.endSession();
  }
}

export async function cleanupBrunoData() {
  const users = await User.find({ email: testUserEmail }).select("_id");
  const userIds = users.map((user) => user._id);
  const orders = userIds.length
    ? await Order.find({ compradorId: { $in: userIds } }).select(
        "linhas leilaoId",
      )
    : [];

  for (const order of orders) {
    if (order.leilaoId) continue;
    await cleanupBrunoOrder(order._id, userIds);
  }

  const auctions = await Auction.find({ lote: testMarker }).select("_id");
  const auctionIds = auctions.map((auction) => auction._id);
  const reviewFilter = userIds.length
    ? { $or: [{ autorId: { $in: userIds } }, { comentario: testMarker }] }
    : { comentario: testMarker };

  await Review.deleteMany(reviewFilter);
  for (const id of auctionIds) await cleanupBrunoAuction(id);
  await Order.deleteMany({
    compradorId: { $in: userIds },
    leilaoId: { $ne: null },
  });
  const testProducts = await Product.find({ nome: testMarker }).select("_id");
  for (const { _id } of testProducts) {
    const product = await Product.findOneAndDelete({ _id, nome: testMarker });
    await productPhotos.remove(product?.fotografia);
  }
  await User.deleteMany({ _id: { $in: userIds } });
}
