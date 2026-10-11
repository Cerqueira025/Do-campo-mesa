import mongoose from 'mongoose';
import { reference, money, quantity, text, unit } from './fields.js';

const currentBidSchema = new mongoose.Schema({
  valor: money(),
  compradorId: { ...reference('User', false), default: null },
}, { _id: false });

const auctionSchema = new mongoose.Schema({
  produtorId: reference('User'),
  produtoId: reference('Product'),
  lote: text,
  quantidade: quantity,
  unidade: unit,
  precoBase: money(),
  incremento: money(1),
  dataInicio: { type: Date, required: true },
  dataFim: { type: Date, required: true },
  estado: { type: String, required: true, enum: ['agendado', 'ativo', 'terminado'] },
  licitacaoAtual: { type: currentBidSchema, required: true },
}, { timestamps: true });

auctionSchema.pre('validate', function () {
  if (this.dataInicio >= this.dataFim) this.invalidate('dataFim', 'O fim deve ser posterior ao início.');
  if (this.licitacaoAtual?.valor < this.precoBase) this.invalidate('licitacaoAtual.valor', 'O valor atual deve ser pelo menos o preço base.');
});

auctionSchema.index({ estado: 1, dataFim: 1 });
auctionSchema.index({ produtorId: 1 });
export default mongoose.model('Auction', auctionSchema, 'auctions');
