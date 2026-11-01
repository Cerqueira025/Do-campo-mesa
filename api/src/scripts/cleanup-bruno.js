import { User, Product, Order, Auction, Bid, Review } from "../models/index.js";
import mongoose from "mongoose";

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
    for (const line of order.linhas) {
      await Product.updateOne(
        { _id: line.produtoId },
        { $inc: { stock: line.quantidade } },
      );
    }
  }

  const auctions = await Auction.find({ lote: testMarker }).select("_id");
  const auctionIds = auctions.map((auction) => auction._id);
  const reviewFilter = userIds.length
    ? { $or: [{ autorId: { $in: userIds } }, { comentario: testMarker }] }
    : { comentario: testMarker };

  await Review.deleteMany(reviewFilter);
  for (const id of auctionIds) await cleanupBrunoAuction(id);
  await Order.deleteMany({ compradorId: { $in: userIds } });
  await Product.deleteMany({ nome: testMarker });
  await User.deleteMany({ _id: { $in: userIds } });
}
