import mongoose from "mongoose";

export const decision = {
  type: new mongoose.Schema(
    {
      administradorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      data: { type: Date, required: true },
      motivo: { type: String, trim: true, maxlength: 500, default: "" },
    },
    { _id: false },
  ),
  select: false,
};

// Documents created or saved directly must also keep administrative data private.
export function privateDecision(_document, value) {
  delete value.ultimaDecisao;
  delete value.bloqueado;
  return value;
}
