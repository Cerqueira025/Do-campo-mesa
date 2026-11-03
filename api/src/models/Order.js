import mongoose from "mongoose";
import { reference, money, quantity, text, unit } from "./fields.js";

const lineSchema = new mongoose.Schema(
  {
    produtoId: reference("Product"),
    nome: text,
    precoUnitario: { ...money(), required: false },
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
    entrega: { type: deliverySchema },
    dataEntrega: Date,
    leilaoId: { ...reference("Auction", false), default: null },
  },
  { timestamps: true },
);

orderSchema.pre("validate", function () {
  if (!this.leilaoId && !this.entrega)
    this.invalidate("entrega", "Indica a modalidade da encomenda.");
  if (this.leilaoId && !this.entrega && this.estado !== "pendente")
    this.invalidate("entrega", "Indica a modalidade da encomenda.");
  if (this.linhas?.length) {
    if (this.leilaoId) {
      if (this.linhas.some((line) => line.precoUnitario != null))
        this.invalidate(
          "linhas",
          "O preço do leilão pertence ao lote completo.",
        );
      if (!Number.isSafeInteger(this.total) || this.total <= 0)
        this.invalidate("total", "O lance vencedor deve ser positivo.");
    } else {
      if (this.linhas.some((line) => !Number.isSafeInteger(line.precoUnitario)))
        this.invalidate("linhas", "Indica o preço de cada linha.");
      // Arredondar cada linha a cêntimos antes de somar quantidades fracionárias.
      const expected = this.linhas.reduce(
        (sum, line) => sum + Math.round(line.precoUnitario * line.quantidade),
        0,
      );
      if (this.total !== expected)
        this.invalidate(
          "total",
          "O total deve corresponder à soma das linhas.",
        );
    }
  }
});

orderSchema.index({ compradorId: 1, createdAt: -1 });
orderSchema.index({ produtorId: 1, estado: 1 });
orderSchema.index(
  { leilaoId: 1 },
  {
    unique: true,
    partialFilterExpression: { leilaoId: { $type: "objectId" } },
  },
);
export default mongoose.model("Order", orderSchema, "orders");
