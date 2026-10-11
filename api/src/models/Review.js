import mongoose from 'mongoose';
import { reference, text } from './fields.js';

const reviewSchema = new mongoose.Schema({
  autorId: reference('User'),
  encomendaId: reference('Order'),
  produtoId: reference('Product', false),
  produtorId: reference('User', false),
  classificacao: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comentario: text,
  estado: { type: String, required: true, default: 'publicada', enum: ['publicada', 'denunciada', 'oculta'] },
}, { timestamps: true });

reviewSchema.pre('validate', function () {
  if (Boolean(this.produtoId) === Boolean(this.produtorId)) {
    this.invalidate('produtoId', 'Escolhe um único alvo: produto ou produtor.');
  }
});

reviewSchema.index({ produtoId: 1, estado: 1 });
reviewSchema.index({ produtorId: 1, estado: 1 });
export default mongoose.model('Review', reviewSchema, 'reviews');
