import mongoose from "mongoose";

export const reference = (model, required = true) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required,
});

export const money = (min = 0) => ({
  type: Number,
  required: true,
  min,
  validate: {
    validator: Number.isSafeInteger,
    message: "Usa cêntimos inteiros.",
  },
});

export const quantity = {
  type: Number,
  required: true,
  min: Number.MIN_VALUE,
  validate: { validator: Number.isFinite, message: "Quantidade inválida." },
};

export const text = { type: String, required: true, trim: true };
export const unit = {
  type: String,
  required: true,
  enum: ["kg", "g", "l", "unidade"],
};
