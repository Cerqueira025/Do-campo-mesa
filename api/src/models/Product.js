import mongoose from "mongoose";
import { reference, money, text, unit } from "./fields.js";
import { decision, privateDecision } from "./decision.js";
import { photoIdPattern } from "../domain/productPhoto.js";

const productSchema = new mongoose.Schema(
  {
    produtorId: reference("User"),
    nome: text,
    descricao: text,
    categoria: text,
    fotografia: { type: String, match: photoIdPattern },
    preco: money(),
    unidade: unit,
    stock: { type: Number, required: true, min: 0, validate: Number.isFinite },
    epoca: { type: [String], default: [] },
    biologico: { type: Boolean, default: false },
    dataValidade: Date,
    publicado: { type: Boolean, default: true },
    bloqueado: { type: Boolean, default: false, select: false },
    ultimaDecisao: decision,
    revisaoLeiloes: { type: Number, default: 0, select: false },
  },
  { timestamps: true, toJSON: { transform: privateDecision } },
);

productSchema.index({ produtorId: 1 });
productSchema.index({ categoria: 1 });
export default mongoose.model("Product", productSchema, "products");
