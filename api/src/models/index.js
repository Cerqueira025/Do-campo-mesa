import User from "./User.js";
import Product from "./Product.js";
import Order from "./Order.js";
import Auction from "./Auction.js";
import Bid from "./Bid.js";
import Review from "./Review.js";

export { User, Product, Order, Auction, Bid, Review };
export const models = [User, Product, Order, Auction, Bid, Review];

export async function initializeCollections() {
  for (const model of models) {
    await model.createCollection();
    await model.createIndexes();
  }
}
