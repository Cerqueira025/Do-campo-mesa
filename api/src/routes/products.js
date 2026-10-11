import { Router } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { requireApprovedProducer, requireAuth } from '../middleware/auth.js';

const router = Router();
const publicProducer = { path: 'produtorId', select: 'nome perfilProdutor.descricao perfilProdutor.localidade perfilProdutor.coordenadas' };
const fields = ['nome', 'descricao', 'categoria', 'preco', 'unidade', 'stock', 'epoca', 'biologico', 'imagens', 'dataValidade', 'publicado'];
const pickProduct = (body) => Object.fromEntries(fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', async (request, response, next) => {
  try {
    const { q, categoria, precoMin, precoMax, bio, epoca, localidade, produtorId, page = '1', limit = '24' } = request.query;
    if ((q && (q.length > 100 || !q.trim())) || (precoMin !== undefined && (!Number.isFinite(Number(precoMin)) || Number(precoMin) < 0)) ||
      (precoMax !== undefined && (!Number.isFinite(Number(precoMax)) || Number(precoMax) < 0)) ||
      (bio !== undefined && !['true', 'false'].includes(bio)) || (produtorId && !mongoose.isValidObjectId(produtorId)) ||
      (localidade && localidade.length > 100) || !/^\d+$/.test(page) || !/^\d+$/.test(limit) ||
      Number(page) < 1 || Number(limit) < 1 || Number(limit) > 100) {
      return response.status(400).json({ erro: 'Filtros ou paginação inválidos.' });
    }
    if (precoMin !== undefined && precoMax !== undefined && Number(precoMin) > Number(precoMax)) {
      return response.status(400).json({ erro: 'O preço mínimo não pode exceder o máximo.' });
    }
    const filter = { publicado: true };
    const constraints = [];
    if (q) {
      const expression = { $regex: escapeRegex(q.trim()), $options: 'i' };
      const matchingProducers = await User.find({ papel: 'produtor', 'perfilProdutor.validacao': 'aceite', nome: expression }).distinct('_id');
      constraints.push({ $or: [
        ...['nome', 'descricao', 'categoria'].map((field) => ({ [field]: expression })),
        { produtorId: { $in: matchingProducers } },
      ] });
    }
    if (categoria) filter.categoria = categoria;
    if (precoMin !== undefined || precoMax !== undefined) {
      filter.preco = {};
      if (precoMin !== undefined) filter.preco.$gte = Math.round(Number(precoMin) * 100);
      if (precoMax !== undefined) filter.preco.$lte = Math.round(Number(precoMax) * 100);
    }
    if (bio !== undefined) filter.biologico = bio === 'true';
    const approved = await User.find({ papel: 'produtor', 'perfilProdutor.validacao': 'aceite' }).distinct('_id');
    constraints.push({ produtorId: { $in: approved } });
    if (produtorId) constraints.push({ produtorId: new mongoose.Types.ObjectId(produtorId) });
    if (localidade) {
      const matchingLocations = await User.find({
        papel: 'produtor', 'perfilProdutor.validacao': 'aceite',
        'perfilProdutor.localidade': { $regex: escapeRegex(localidade), $options: 'i' },
      }).distinct('_id');
      constraints.push({ produtorId: { $in: matchingLocations } });
    }
    if (epoca) filter.epoca = epoca;
    filter.$and = constraints;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1, _id: 1 }).skip(skip).limit(Number(limit)).populate(publicProducer),
      Product.countDocuments(filter),
    ]);
    response.json({ items, page: Number(page), limit: Number(limit), total });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ erro: 'Produto não encontrado.' });
    const approved = await User.find({ papel: 'produtor', 'perfilProdutor.validacao': 'aceite' }).distinct('_id');
    const product = await Product.findOne({ _id: request.params.id, publicado: true, produtorId: { $in: approved } }).populate(publicProducer);
    if (!product) return response.status(404).json({ erro: 'Produto não encontrado.' });
    response.json(product);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth('produtor'), requireApprovedProducer, async (request, response, next) => {
  try {
    const product = await Product.create({ ...pickProduct(request.body), produtorId: request.user.id });
    await product.populate(publicProducer);
    response.status(201).location(`/api/products/${product.id}`).json(product);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth('produtor'), requireApprovedProducer, async (request, response, next) => {
  try {
    const product = await Product.findOne({ _id: request.params.id, produtorId: request.user.id });
    if (!product) return response.status(404).json({ erro: 'Produto não encontrado.' });
    product.set(pickProduct(request.body));
    await product.save();
    await product.populate(publicProducer);
    response.json(product);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth('produtor'), requireApprovedProducer, async (request, response, next) => {
  try {
    const deleted = await Product.findOneAndDelete({ _id: request.params.id, produtorId: request.user.id });
    if (!deleted) return response.status(404).json({ erro: 'Produto não encontrado.' });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
