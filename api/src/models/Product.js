import mongoose from 'mongoose';
import { reference, money, text, unit } from './fields.js';

const productSchema = new mongoose.Schema({
  produtorId: reference('User'),
  nome: text,
  descricao: text,
  categoria: text,
  preco: money(),
  unidade: unit,
  stock: { type: Number, required: true, min: 0, validate: Number.isFinite },
  epoca: { type: [String], default: [] },
  biologico: { type: Boolean, default: false },
  imagens: { type: [String], default: [] },
  dataValidade: Date,
  publicado: { type: Boolean, default: true },
  revisaoLeiloes: { type: Number, default: 0, select: false },
}, { timestamps: true });

productSchema.index({ produtorId: 1 });
productSchema.index({ categoria: 1 });
export default mongoose.model('Product', productSchema, 'products');
