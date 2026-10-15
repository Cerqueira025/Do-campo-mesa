import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const states = ['pendente', 'confirmada', 'pronta', 'entregue'];

router.post('/', requireAuth('comprador'), async (request, response, next) => {
  const { linhas, entrega } = request.body;
  if (!Array.isArray(linhas) || !linhas.length || linhas.some((line) =>
    !mongoose.isValidObjectId(line.produtoId) || !Number.isFinite(line.quantidade) || line.quantidade <= 0)) {
    return response.status(400).json({ erro: 'Indica linhas com produto e quantidade válida.' });
  }
  if (!entrega || !['levantamento', 'entrega'].includes(entrega.tipo) ||
    (entrega.tipo === 'entrega' && (typeof entrega.morada !== 'string' || !entrega.morada.trim()))) {
    return response.status(400).json({ erro: 'Dados de entrega ou levantamento inválidos.' });
  }

  const quantities = new Map();
  for (const line of linhas) quantities.set(line.produtoId, (quantities.get(line.produtoId) || 0) + line.quantidade);
  const session = await mongoose.startSession();
  try {
    let order;
    await session.withTransaction(async () => {
      const products = await Product.find({
        _id: { $in: [...quantities.keys()] }, publicado: true,
      }).session(session);
      if (products.length !== quantities.size) throw Object.assign(new Error('Um ou mais produtos estão indisponíveis.'), { status: 409 });
      const producerId = String(products[0].produtorId);
      if (products.some((product) => String(product.produtorId) !== producerId)) {
        throw Object.assign(new Error('Cria uma encomenda por produtor.'), { status: 400 });
      }
      const lines = products.map((product) => ({
        produtoId: product.id, nome: product.nome, precoUnitario: product.preco,
        quantidade: quantities.get(String(product._id)), unidade: product.unidade,
      }));
      const total = lines.reduce((sum, line) => sum + Math.round(line.precoUnitario * line.quantidade), 0);
      if (!Number.isSafeInteger(total)) throw Object.assign(new Error('O total excede o limite permitido.'), { status: 400 });

      for (const product of products) {
        const updated = await Product.findOneAndUpdate({
          _id: product._id, publicado: true, stock: { $gte: quantities.get(String(product._id)) },
        }, { $inc: { stock: -quantities.get(String(product._id)) } }, { new: true, session, runValidators: true });
        if (!updated) throw Object.assign(new Error(`Stock insuficiente para ${product.nome}.`), { status: 409 });
      }

      [order] = await Order.create([{
        compradorId: request.user.id, produtorId: producerId, linhas, total,
        estado: 'pendente', entrega,
      }], { session });
    });
    await order.populate('produtorId', 'nome');
    response.status(201).location(`/api/orders/${order.id}`).json(order);
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

router.get('/', requireAuth(), async (request, response, next) => {
  try {
    const filter = request.user.papel === 'administrador'
      ? {} : { $or: [{ compradorId: request.user.id }, { produtorId: request.user.id }] };
    const orders = await Order.find(filter).sort({ createdAt: -1 })
      .populate('compradorId', 'nome').populate('produtorId', 'nome');
    response.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth(), async (request, response, next) => {
  try {
    const filter = { _id: request.params.id };
    if (request.user.papel !== 'administrador') {
      filter.$or = [{ compradorId: request.user.id }, { produtorId: request.user.id }];
    }
    const order = await Order.findOne(filter).populate('compradorId', 'nome').populate('produtorId', 'nome');
    if (!order) return response.status(404).json({ erro: 'Encomenda não encontrada.' });
    response.json(order);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/estado', requireAuth('produtor'), async (request, response, next) => {
  try {
    const { estado } = request.body;
    if (!states.includes(estado)) return response.status(400).json({ erro: 'Estado de encomenda inválido.' });
    const order = await Order.findOne({ _id: request.params.id, produtorId: request.user.id });
    if (!order) return response.status(404).json({ erro: 'Encomenda não encontrada.' });
    if (states.indexOf(estado) !== states.indexOf(order.estado) + 1) {
      return response.status(409).json({ erro: 'A encomenda só pode avançar para o estado seguinte.' });
    }
    order.estado = estado;
    if (estado === 'entregue') order.dataEntrega = new Date();
    await order.save();
    response.json(order);
  } catch (error) {
    next(error);
  }
});

export default router;
