import { Router } from 'express';
import mongoose from 'mongoose';
import Auction from '../models/Auction.js';
import Product from '../models/Product.js';
import { requireApprovedProducer, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', async (request, response, next) => {
  try {
    const { estado } = request.query;
    if (estado && !['agendado', 'ativo', 'terminado'].includes(estado)) return response.status(400).json({ erro: 'Estado de leilão inválido.' });
    const filter = estado ? { estado } : {};
    const auctions = await Auction.find(filter).sort({ dataFim: 1 }).populate('produtoId', 'nome imagens').populate('produtorId', 'nome perfilProdutor.localidade');
    response.json(auctions);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (request, response, next) => {
  try {
    const auction = await Auction.findById(request.params.id)
      .populate('produtoId', 'nome descricao unidade imagens')
      .populate('produtorId', 'nome perfilProdutor.descricao perfilProdutor.localidade');
    if (!auction) return response.status(404).json({ erro: 'Leilão não encontrado.' });
    response.json(auction);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth('produtor'), requireApprovedProducer, async (request, response, next) => {
  try {
    const { produtoId, lote, quantidade, precoBase, incremento, dataInicio, dataFim } = request.body;
    if (!mongoose.isValidObjectId(produtoId)) return response.status(400).json({ erro: 'Produto inválido.' });
    const product = await Product.findOne({ _id: produtoId, produtorId: request.user.id, publicado: true });
    if (!product) return response.status(404).json({ erro: 'Produto não encontrado ou não pertence ao produtor.' });
    if (typeof quantidade !== 'number' || quantidade <= 0 || quantidade > product.stock) {
      return response.status(400).json({ erro: 'A quantidade do lote deve ser positiva e não pode exceder o stock.' });
    }
    const start = new Date(dataInicio);
    const end = new Date(dataFim);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      return response.status(400).json({ erro: 'As datas do leilão são inválidas.' });
    }
    const estado = end <= new Date() ? 'terminado' : start <= new Date() ? 'ativo' : 'agendado';
    const auction = await Auction.create({
      produtorId: request.user.id, produtoId, lote, quantidade, unidade: product.unidade,
      precoBase, incremento, dataInicio: start, dataFim: end, estado,
      licitacaoAtual: { valor: precoBase, compradorId: null },
    });
    await auction.populate('produtoId', 'nome imagens');
    response.status(201).location(`/api/auctions/${auction.id}`).json(auction);
  } catch (error) {
    next(error);
  }
});

export default router;
