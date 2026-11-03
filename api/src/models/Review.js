import mongoose from "mongoose";
import { reference, text } from "./fields.js";
import { decision, privateDecision } from "./decision.js";

const reviewSchema = new mongoose.Schema(
  {
    ultimaDecisao: decision,
    denuncias: {
      type: [
        new mongoose.Schema(
          {
            autorId: reference("User"),
            motivo: { ...text, maxlength: 500 },
            data: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
      select: false,
    },
    autorId: reference("User"),
    encomendaId: reference("Order"),
    produtoId: reference("Product", false),
    produtorId: reference("User", false),
    classificacao: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger,
    },
    comentario: text,
    estado: {
      type: String,
      required: true,
      default: "publicada",
      enum: ["publicada", "denunciada", "oculta"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(document, value) {
        delete value.denuncias;
        return privateDecision(document, value);
      },
    },
  },
);

reviewSchema.pre("validate", function () {
  if (Boolean(this.produtoId) === Boolean(this.produtorId)) {
    this.invalidate("produtoId", "Escolhe um único alvo: produto ou produtor.");
  }
});

reviewSchema.index({ produtoId: 1, estado: 1 });
reviewSchema.index({ produtorId: 1, estado: 1 });
reviewSchema.index(
  { autorId: 1, encomendaId: 1, produtoId: 1, produtorId: 1 },
  {
    unique: true,
    name: "review_author_order_target_unique",
  },
);
export default mongoose.model("Review", reviewSchema, "reviews");
