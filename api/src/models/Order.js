import mongoose from "mongoose";
import { reference, money, quantity, text, unit } from "./fields.js";

const lineSchema = new mongoose.Schema(
  {
    produtoId: reference("Product"),
    nome: text,
    precoUnitario: money(),
    quantidade: quantity,
    unidade: unit,
  },
  { _id: false },
);

const deliverySchema = new mongoose.Schema(
  {
    tipo: { type: String, required: true, enum: ["levantamento", "entrega"] },
    morada: {
      type: String,
      trim: true,
      required() {
        return this.tipo === "entrega";
      },
    },
    dataPrevista: Date,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    compradorId: reference("User"),
    produtorId: reference("User"),
    linhas: {
      type: [lineSchema],
      required: true,
      validate: {
        validator: (lines) => lines.length > 0,
        message: "A encomenda precisa de linhas.",
      },
    },
    total: money(),
    estado: {
      type: String,
      required: true,
      default: "pendente",
      enum: ["pendente", "confirmada", "pronta", "entregue"],
    },
    entrega: { type: deliverySchema, required: true },
    dataEntrega: Date,
    leilaoId: { ...reference("Auction", false), default: null },
  },
  { timestamps: true },
);

orderSchema.pre("validate", function () {
  if (this.linhas?.length) {
    // Arredondar cada linha a cêntimos antes de somar quantidades fracionárias.
    const expected = this.linhas.reduce(
      (sum, line) => sum + Math.round(line.precoUnitario * line.quantidade),
      0,
    );
    if (this.total !== expected)
      this.invalidate("total", "O total deve corresponder à soma das linhas.");
  }
});

orderSchema.index({ compradorId: 1, createdAt: -1 });
orderSchema.index({ produtorId: 1, estado: 1 });
export default mongoose.model("Order", orderSchema, "orders");
