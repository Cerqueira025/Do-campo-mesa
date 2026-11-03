import mongoose from "mongoose";

const schema = new mongoose.Schema({
  hash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  state: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  tokenExpiresAt: { type: Number, required: true },
});

export default mongoose.model("BackofficeCode", schema, "backoffice_codes");
