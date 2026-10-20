import { Router } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import Auction from '../models/Auction.js';
import { requireApprovedProducer, requireAuth } from '../middleware/auth.js';
import { requireObjectBody } from '../middleware/requestBody.js';

const router = Router();
const publicProducer = { path: 'produtorId', select: 'nome perfilProdutor.descricao perfilProdutor.localidade perfilProdutor.coordenadas' };
const fields = ['nome', 'descricao', 'categoria', 'preco', 'unidade', 'stock', 'epoca', 'biologico', 'dataValidade', 'publicado'];
const pickProduct = (body) => Object.fromEntries(fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', async (request, response, next) => {
  try {
    const { q, categoria, precoMin, precoMax, bio, epoca, localidade, produtorId, avaliacaoMin, page = '1', limit = '24' } = request.query;
    if ([q, categoria, precoMin, precoMax, bio, epoca, localidade, produtorId, avaliacaoMin, page, limit]
      .some(value => value !== undefined && typeof value !== 'string')) {
      return response.status(400).json({ erro: 'Filtros ou paginação inválidos.' });
    }
    const invalidPrice = value => value !== undefined && (!value.trim() || Number(value) < 0 ||
      !Number.isSafeInteger(Math.round(Number(value) * 100)));
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;
    if ((q && (q.length > 100 || !q.trim())) || invalidPrice(precoMin) || invalidPrice(precoMax) ||
      (bio !== undefined && !['true', 'false'].includes(bio)) || (produtorId && !mongoose.isValidObjectId(produtorId)) ||
      (avaliacaoMin !== undefined && (!avaliacaoMin.trim() || !Number.isFinite(Number(avaliacaoMin)) ||
        Number(avaliacaoMin) < 1 || Number(avaliacaoMin) > 5)) ||
      (localidade && localidade.length > 100) || !/^\d+$/.test(page) || !/^\d+$/.test(limit) ||
      !Number.isSafeInteger(pageNumber) || pageNumber < 1 || !Number.isSafeInteger(skip) ||
      limitNumber < 1 || limitNumber > 100) {
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
    if (epoca) filter.epoca = ['primavera', 'verao', 'outono', 'inverno'].includes(epoca)
      ? { $in: [epoca, 'todo-o-ano'] } : epoca;
    if (avaliacaoMin !== undefined) {
      const ratings = await Review.aggregate([
        { $match: { estado: 'publicada', produtoId: { $ne: null } } },
        { $group: { _id: '$produtoId', media: { $avg: '$classificacao' } } },
        { $match: { media: { $gte: Number(avaliacaoMin) } } },
      ]);
      filter._id = { $in: ratings.map((rating) => rating._id) };
    }
    filter.$and = constraints;
    const [items, total] = await Promise.all([
      Product.find(filter).select('-imagens').sort({ createdAt: -1, _id: 1 }).skip(skip).limit(limitNumber).populate(publicProducer),
      Product.countDocuments(filter),
    ]);
    response.json({ items, page: pageNumber, limit: limitNumber, total });
  } catch (error) {
    next(error);
  }
});

router.get('/filters', async (_request, response, next) => {
  try {
    const approved = await User.find({ papel: 'produtor', 'perfilProdutor.validacao': 'aceite' })
      .select('nome perfilProdutor.localidade').lean();
    const filter = { publicado: true, produtorId: { $in: approved.map((producer) => producer._id) } };
    const [categories, producerIds] = await Promise.all([
      Product.distinct('categoria', filter),
      Product.distinct('produtorId', filter),
    ]);
    const ids = new Set(producerIds.map(String));
    const producers = approved.filter((producer) => ids.has(String(producer._id)));
    const alphabetical = (a, b) => a.localeCompare(b, 'pt-PT');
    response.json({
      categorias: categories.filter(Boolean).sort(alphabetical),
      produtores: producers.map((producer) => ({ id: String(producer._id), nome: producer.nome }))
        .sort((a, b) => alphabetical(a.nome, b.nome) || alphabetical(a.id, b.id)),
      localidades: [...new Set(producers.map((producer) => producer.perfilProdutor?.localidade).filter(Boolean))]
        .sort(alphabetical),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ erro: 'Produto não encontrado.' });
    const product = await Product.findOne({ _id: request.params.id, publicado: true }).select('-imagens').populate({
      ...publicProducer, match: { papel: 'produtor', 'perfilProdutor.validacao': 'aceite' },
    }).lean();
    if (!product?.produtorId) return response.status(404).json({ erro: 'Produto não encontrado.' });
    response.json(product);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth('produtor'), requireApprovedProducer, requireObjectBody, async (request, response, next) => {
  try {
    const product = await Product.create({ ...pickProduct(request.body), produtorId: request.user.id });
    await product.populate(publicProducer);
    response.status(201).location(`/api/products/${product.id}`).json(product);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth('produtor'), requireApprovedProducer, requireObjectBody, async (request, response, next) => {
  let session;
  try {
    let product;
    async function update() {
      const query = Product.findOne({ _id: request.params.id, produtorId: request.user.id }).select('-imagens');
      product = await (session ? query.session(session) : query);
      if (!product) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });
      product.set(pickProduct(request.body));
      if (session && (product.isModified('stock') || product.isModified('unidade')) &&
          await Auction.exists({ 'produtos.produtoId': product._id, reservaStock: { $in: ['reservada', 'atribuida'] } }).session(session)) {
        throw Object.assign(new Error('Não é possível alterar stock ou unidade de um produto com quantidades reservadas ou atribuídas.'), { status: 409 });
      }
      await product.save(session ? { session } : {});
    }
    if (request.body.stock !== undefined || request.body.unidade !== undefined) {
      session = await mongoose.startSession();
      await session.withTransaction(update);
      product.$session(null);
    } else await update();
    await product.populate(publicProducer);
    response.json(product);
  } catch (error) {
    next(error);
  } finally {
    if (session) await session.endSession();
  }
});

router.delete('/:id', requireAuth('produtor'), requireApprovedProducer, async (request, response, next) => {
  let session;
  try {
    const filter = { _id: request.params.id, produtorId: request.user.id };
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      // A mesma escrita na criação de leilões serializa as duas operações.
      const product = await Product.findOneAndUpdate(filter, { $inc: { revisaoLeiloes: 1 } }, {
        new: true, session, timestamps: false,
      });
      if (!product) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });
      if (await Auction.exists({ 'produtos.produtoId': product._id }).session(session)) {
        throw Object.assign(new Error('Não é possível apagar um produto com leilões associados.'), { status: 409 });
      }
      const deleted = await Product.findOneAndDelete(filter, { session });
      if (!deleted) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });
    });
    response.status(204).end();
  } catch (error) {
    next(error);
  } finally {
    if (session) await session.endSession();
  }
});

export default router;
