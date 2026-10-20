import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import { requireAuth } from '../middleware/auth.js';
import { requireObjectBody } from '../middleware/requestBody.js';

const router = Router();

async function publicReviews(filter, response) {
  const [items, summary] = await Promise.all([
    Review.find({ ...filter, estado: 'publicada' }).sort({ createdAt: -1 }).populate('autorId', 'nome'),
    Review.aggregate([{ $match: { ...filter, estado: 'publicada' } }, { $group: { _id: null, media: { $avg: '$classificacao' }, total: { $sum: 1 } } }]),
  ]);
  response.json({ items, media: summary.length ? Math.round(summary[0].media * 100) / 100 : null, total: summary[0]?.total || 0 });
}

router.post('/', requireAuth('comprador'), requireObjectBody, async (request, response, next) => {
  try {
    const { encomendaId, produtoId, produtorId, classificacao, comentario } = request.body || {};
    if (!mongoose.isValidObjectId(encomendaId) || (Boolean(produtoId) === Boolean(produtorId))) {
      return response.status(400).json({ erro: 'Indica uma encomenda e um único produto ou produtor.' });
    }
    const order = await Order.findOne({ _id: encomendaId, compradorId: request.user.id, estado: 'entregue' });
    if (!order) return response.status(400).json({ erro: 'Só podes avaliar encomendas entregues que te pertencem.' });
    if (produtoId && (!mongoose.isValidObjectId(produtoId) || !order.linhas.some((line) => String(line.produtoId) === produtoId))) {
      return response.status(400).json({ erro: 'O produto não pertence à encomenda.' });
    }
    if (produtorId && (!mongoose.isValidObjectId(produtorId) || String(order.produtorId) !== produtorId)) {
      return response.status(400).json({ erro: 'O produtor não pertence à encomenda.' });
    }
    const review = await Review.create({
      autorId: request.user.id, encomendaId: order.id,
      ...(produtoId ? { produtoId } : { produtorId }), classificacao, comentario,
      estado: 'publicada',
    });
    await review.populate('autorId', 'nome');
    response.status(201).location(`/api/reviews/${review.id}`).json(review);
  } catch (error) {
    if (error.code === 11000 && Object.keys(error.keyPattern || {}).length === 4 &&
        ['autorId', 'encomendaId', 'produtoId', 'produtorId'].every(field => error.keyPattern[field] === 1)) {
      return response.status(409).json({ erro: 'Já avaliou este alvo nesta encomenda.' });
    }
    next(error);
  }
});

router.get('/products/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ erro: 'Produto não encontrado.' });
    await publicReviews({ produtoId: new mongoose.Types.ObjectId(request.params.id) }, response);
  } catch (error) {
    next(error);
  }
});

router.get('/producers/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ erro: 'Produtor não encontrado.' });
    await publicReviews({ produtorId: new mongoose.Types.ObjectId(request.params.id) }, response);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/moderacao', requireAuth('administrador'), requireObjectBody, async (request, response, next) => {
  try {
    const { estado } = request.body;
    if (!['publicada', 'oculta'].includes(estado)) return response.status(400).json({ erro: 'A moderação deve publicar ou ocultar a avaliação.' });
    const review = await Review.findByIdAndUpdate(request.params.id, { $set: { estado } }, { new: true, runValidators: true })
      .populate('autorId', 'nome');
    if (!review) return response.status(404).json({ erro: 'Avaliação não encontrada.' });
    response.json(review);
  } catch (error) {
    next(error);
  }
});

export default router;
