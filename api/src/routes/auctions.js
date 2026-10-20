import { Router } from 'express';
import mongoose from 'mongoose';
import Auction from '../models/Auction.js';
import Product from '../models/Product.js';
import { requireApprovedProducer, requireAuth } from '../middleware/auth.js';
import { requireObjectBody } from '../middleware/requestBody.js';
import { auctionState, auctionStateFilter } from '../domain/auction.js';

const router = Router();
const publicProduct = { path: 'produtos.produtoId', match: { publicado: true } };
const publicProducer = {
  path: 'produtorId',
  match: { papel: 'produtor', 'perfilProdutor.validacao': 'aceite' },
};

function publicAuction(auction, now) {
  if (!auction?.produtorId || !auction.produtos?.length || auction.produtos.some(line =>
    !line.produtoId || String(line.produtoId.produtorId) !== String(auction.produtorId._id))) return null;
  const produtos = auction.produtos.map(line => {
    const { produtorId: _owner, ...product } = line.produtoId;
    return { ...line, produtoId: product };
  });
  return { ...auction, produtos, estado: auctionState(auction, now) };
}

router.get('/', async (request, response, next) => {
  try {
    const now = Date.now();
    const { estado } = request.query;
    if (estado !== undefined && (typeof estado !== 'string' || !['agendado', 'ativo', 'terminado', 'cancelado'].includes(estado))) {
      return response.status(400).json({ erro: 'Estado de leilão inválido.' });
    }
    const auctions = await Auction.find(auctionStateFilter(estado, now)).sort({ dataFim: 1 })
      .populate({ ...publicProduct, select: 'nome imagens produtorId' })
      .populate({ ...publicProducer, select: 'nome perfilProdutor.localidade' }).lean();
    response.json(auctions.map(auction => publicAuction(auction, now)).filter(Boolean));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (request, response, next) => {
  try {
    const now = Date.now();
    if (!mongoose.isObjectIdOrHexString(request.params.id)) return response.status(404).json({ erro: 'Leilão não encontrado.' });
    const auction = await Auction.findById(request.params.id)
      .populate({ ...publicProduct, select: 'nome descricao unidade imagens produtorId' })
      .populate({ ...publicProducer, select: 'nome perfilProdutor.descricao perfilProdutor.localidade' }).lean();
    const result = publicAuction(auction, now);
    if (!result) return response.status(404).json({ erro: 'Leilão não encontrado.' });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth('produtor'), requireApprovedProducer, requireObjectBody, async (request, response, next) => {
  let session;
  try {
    const now = Date.now();
    const { produtos, lote, precoBase, incremento, dataInicio, dataFim } = request.body || {};
    if (!Array.isArray(produtos) || !produtos.length || produtos.some(line =>
      !line || typeof line.produtoId !== 'string' || !mongoose.isObjectIdOrHexString(line.produtoId) ||
      !Number.isFinite(line.quantidade) || line.quantidade <= 0)) {
      return response.status(400).json({ erro: 'Indica pelo menos um produto com quantidade válida.' });
    }
    const ids = produtos.map(line => line.produtoId.toLowerCase());
    if (new Set(ids).size !== ids.length) return response.status(400).json({ erro: 'Os produtos do lote não podem repetir-se.' });
    if (typeof dataInicio !== 'string' || !dataInicio.trim() || typeof dataFim !== 'string' || !dataFim.trim()) {
      return response.status(400).json({ erro: 'As datas do leilão são inválidas.' });
    }
    const start = new Date(dataInicio);
    const end = new Date(dataFim);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end.getTime() <= now) {
      return response.status(400).json({ erro: 'As datas do leilão são inválidas.' });
    }
    session = await mongoose.startSession();
    let auction;
    await session.withTransaction(async () => {
      const byId = new Map();
      for (const id of [...ids].sort()) {
        const product = await Product.findOneAndUpdate({ _id: id, produtorId: request.user.id, publicado: true }, {
          $inc: { revisaoLeiloes: 1 },
        }, { new: true, session, timestamps: false });
        if (!product) throw Object.assign(new Error('Produto não encontrado ou não pertence ao produtor.'), { status: 404 });
        byId.set(id, product);
      }
      const lines = produtos.map((line, index) => ({
        produtoId: ids[index], quantidade: line.quantidade, unidade: byId.get(ids[index]).unidade,
      }));
      if (lines.some(line => line.quantidade > byId.get(line.produtoId).stock)) {
        throw Object.assign(new Error('A quantidade de cada produto não pode exceder o stock.'), { status: 400 });
      }
      [auction] = await Auction.create([{
        produtorId: request.user.id, produtos: lines, lote,
        precoBase, incremento, dataInicio: start, dataFim: end, estado: 'agendado', reservaStock: 'pendente',
        licitacaoAtual: { valor: precoBase, compradorId: null },
      }], { session });
    });
    auction.$session(null);
    await auction.populate('produtos.produtoId', 'nome imagens');
    response.status(201).location(`/api/auctions/${auction.id}`).json(auction);
  } catch (error) {
    next(error);
  } finally {
    if (session) await session.endSession();
  }
});

export default router;
