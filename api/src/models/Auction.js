import mongoose from "mongoose";
import { reference, money, quantity, text, unit } from "./fields.js";

const currentBidSchema = new mongoose.Schema(
  {
    valor: money(),
    compradorId: { ...reference("User", false), default: null },
  },
  { _id: false },
);

const productLineSchema = new mongoose.Schema(
  {
    produtoId: reference("Product"),
    quantidade: quantity,
    unidade: unit,
  },
  { _id: false },
);

const auctionSchema = new mongoose.Schema(
  {
    produtorId: reference("User"),
    produtos: {
      type: [productLineSchema],
      required: true,
      default: undefined,
      validate: {
        validator(lines) {
          return (
            Array.isArray(lines) &&
            lines.length > 0 &&
            new Set(lines.map((line) => String(line.produtoId))).size ===
              lines.length
          );
        },
        message: "Indica pelo menos um produto, sem repetições.",
      },
    },
    lote: text,
    precoBase: money(),
    incremento: money(1),
    dataInicio: { type: Date, required: true },
    dataFim: { type: Date, required: true },
    estado: {
      type: String,
      required: true,
      enum: ["agendado", "ativo", "terminado", "cancelado"],
    },
    reservaStock: {
      type: String,
      required: true,
      enum: ["pendente", "reservada", "libertada", "atribuida", "sem-reserva"],
    },
    motivoCancelamento: {
      type: String,
      enum: [
        "stock-insuficiente",
        "produto-indisponivel",
        "produtor-indisponivel",
      ],
      required() {
        return this.estado === "cancelado";
      },
    },
    licitacaoAtual: { type: currentBidSchema, required: true },
  },
  { timestamps: true },
);

auctionSchema.pre("validate", function () {
  if (this.dataInicio >= this.dataFim)
    this.invalidate("dataFim", "O fim deve ser posterior ao início.");
  if (this.licitacaoAtual?.valor < this.precoBase)
    this.invalidate(
      "licitacaoAtual.valor",
      "O valor atual deve ser pelo menos o preço base.",
    );
  const states = {
    pendente: ["agendado"],
    reservada: ["ativo", "terminado"],
    libertada: ["terminado"],
    atribuida: ["terminado"],
    "sem-reserva": ["terminado", "cancelado"],
  };
  if (this.reservaStock && !states[this.reservaStock]?.includes(this.estado)) {
    this.invalidate(
      "reservaStock",
      "O estado da reserva é incompatível com o estado do leilão.",
    );
  }
});

auctionSchema.index({ estado: 1, dataFim: 1 });
auctionSchema.index({ produtorId: 1 });
auctionSchema.index({ "produtos.produtoId": 1 });
auctionSchema.index({ reservaStock: 1, dataFim: 1 });
auctionSchema.index({ reservaStock: 1, dataInicio: 1, _id: 1 });
export default mongoose.model("Auction", auctionSchema, "auctions");
