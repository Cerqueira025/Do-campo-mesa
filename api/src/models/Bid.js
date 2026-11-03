import mongoose from "mongoose";
import { reference, money } from "./fields.js";

const bidSchema = new mongoose.Schema(
  {
    leilaoId: reference("Auction"),
    compradorId: reference("User"),
    valor: money(1),
  },
  { timestamps: true },
);

bidSchema.index({ leilaoId: 1, createdAt: -1 });
export default mongoose.model("Bid", bidSchema, "bids");
