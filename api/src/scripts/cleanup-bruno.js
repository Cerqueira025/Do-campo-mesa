import { User, Product, Order, Auction, Bid, Review } from '../models/index.js';

const testUserEmail = /^bruno-test-[0-9]+-[a-z0-9]+@example\.test$/;
const testMarker = /^BRUNO_AUTOTEST_/;

export async function cleanupBrunoData() {
  const users = await User.find({ email: testUserEmail }).select('_id');
  const userIds = users.map((user) => user._id);
  const orders = userIds.length ? await Order.find({ compradorId: { $in: userIds } }).select('linhas leilaoId') : [];

  for (const order of orders) {
    if (order.leilaoId) continue;
    for (const line of order.linhas) {
      await Product.updateOne({ _id: line.produtoId }, { $inc: { stock: line.quantidade } });
    }
  }

  const auctions = await Auction.find({ lote: testMarker }).select('_id');
  const auctionIds = auctions.map((auction) => auction._id);
  const reviewFilter = userIds.length
    ? { $or: [{ autorId: { $in: userIds } }, { comentario: testMarker }] }
    : { comentario: testMarker };

  await Review.deleteMany(reviewFilter);
  if (auctionIds.length) await Bid.deleteMany({ leilaoId: { $in: auctionIds } });
  await Auction.deleteMany({ _id: { $in: auctionIds } });
  await Order.deleteMany({ compradorId: { $in: userIds } });
  await Product.deleteMany({ nome: testMarker });
  await User.deleteMany({ _id: { $in: userIds } });
}
