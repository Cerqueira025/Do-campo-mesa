import mongoose from "mongoose";
import { text } from "./fields.js";
import { decision, privateDecision } from "./decision.js";

const producerSchema = new mongoose.Schema(
  {
    descricao: { type: String, trim: true, default: "" },
    localidade: text,
    morada: text,
    coordenadas: {
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
    },
    validacao: {
      type: String,
      required: true,
      default: "pendente",
      enum: ["pendente", "aceite", "rejeitado"],
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    ultimaDecisao: decision,
    papel: {
      type: String,
      required: true,
      enum: ["comprador", "produtor", "administrador"],
    },
    nome: text,
    email: {
      ...text,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
      match: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/,
    },
    perfilProdutor: {
      type: producerSchema,
      required() {
        return this.papel === "produtor";
      },
      validate: {
        validator(value) {
          return !value || this.papel === "produtor";
        },
        message: "O perfil de produtor exige o papel produtor.",
      },
    },
  },
  { timestamps: true, toJSON: { transform: privateDecision } },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.methods.publico = function publico() {
  return {
    id: this.id,
    nome: this.nome,
    email: this.email,
    papel: this.papel,
    ...(this.papel === "produtor"
      ? { validacao: this.perfilProdutor.validacao }
      : {}),
  };
};
export default mongoose.model("User", userSchema, "users");
