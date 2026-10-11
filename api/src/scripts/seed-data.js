import mongoose from 'mongoose';
import { User, Product, Order, Auction, Bid, Review } from '../models/index.js';

export const seedId = (number) => new mongoose.Types.ObjectId(`dca000000000${number.toString(16).padStart(12, '0')}`);

export function seedData(passwordHash, now = new Date()) {
  const id = seedId;
  const at = (hours) => new Date(now.getTime() + hours * 3600000);
  const profile = (validacao) => ({
    descricao: 'Exploração fictícia para demonstração.', localidade: 'Viana do Castelo',
    morada: 'Morada de demonstração', coordenadas: { latitude: 41.6946, longitude: -8.8302 }, validacao,
  });
  const users = [
    { _id: id(1), papel: 'administrador', nome: 'Admin Demo', email: 'admin@example.test' },
    { _id: id(2), papel: 'comprador', nome: 'Ana Demo', email: 'ana@example.test' },
    { _id: id(3), papel: 'comprador', nome: 'Restaurante Demo', email: 'restaurante@example.test' },
    { _id: id(4), papel: 'produtor', nome: 'Quinta Demo', email: 'produtor@example.test', perfilProdutor: profile('aceite') },
    { _id: id(5), papel: 'produtor', nome: 'Produtor Pendente Demo', email: 'pendente@example.test', perfilProdutor: profile('pendente') },
    { _id: id(6), papel: 'produtor', nome: 'Produtor Rejeitado Demo', email: 'rejeitado@example.test', perfilProdutor: profile('rejeitado') },
  ].map((user) => ({ ...user, passwordHash }));

  const products = [
    { _id: id(101), nome: 'Batata', categoria: 'Hortícolas', preco: 150, unidade: 'kg', stock: 80, epoca: ['verao', 'outono'], biologico: true },
    { _id: id(102), nome: 'Maçã', categoria: 'Fruta', preco: 240, unidade: 'kg', stock: 40, epoca: ['outono'], biologico: false },
    { _id: id(103), nome: 'Mel', categoria: 'Mel', preco: 700, unidade: 'unidade', stock: 15, epoca: ['todo-o-ano'], biologico: true },
  ].map((product) => ({ ...product, produtorId: id(4), descricao: `${product.nome} de demonstração.`, imagens: [] }));

  const line = (product, quantidade) => ({
    produtoId: product._id, nome: product.nome, precoUnitario: product.preco, quantidade, unidade: product.unidade,
  });
  const orders = [
    { _id: id(201), compradorId: id(2), linhas: [line(products[0], 2), line(products[2], 1)], total: 1000, estado: 'entregue', entrega: { tipo: 'levantamento' }, dataEntrega: at(-24) },
    { _id: id(202), compradorId: id(3), linhas: [line(products[1], 3)], total: 720, estado: 'pendente', entrega: { tipo: 'entrega', morada: 'Restaurante de demonstração', dataPrevista: at(24) } },
    { _id: id(203), compradorId: id(2), linhas: [line(products[0], 1.5)], total: 225, estado: 'pronta', entrega: { tipo: 'levantamento', dataPrevista: at(12) } },
  ].map((order) => ({ ...order, produtorId: id(4), leilaoId: null }));

  const auctions = [
    { _id: id(301), lote: 'Lote de batata agendado', quantidade: 10, precoBase: 1000, incremento: 100, dataInicio: at(24), dataFim: at(25), estado: 'agendado', licitacaoAtual: { valor: 1000, compradorId: null } },
    { _id: id(302), lote: 'Lote de batata ativo', quantidade: 20, precoBase: 2000, incremento: 100, dataInicio: at(-1), dataFim: at(1), estado: 'ativo', licitacaoAtual: { valor: 2500, compradorId: id(3) } },
    { _id: id(303), lote: 'Lote de batata terminado', quantidade: 10, precoBase: 1000, incremento: 100, dataInicio: at(-48), dataFim: at(-47), estado: 'terminado', licitacaoAtual: { valor: 1600, compradorId: id(2) } },
  ].map((auction) => ({ ...auction, produtorId: id(4), produtoId: id(101), unidade: 'kg' }));

  const bids = [
    { _id: id(401), leilaoId: id(302), compradorId: id(2), valor: 2100, createdAt: at(-0.8) },
    { _id: id(402), leilaoId: id(302), compradorId: id(3), valor: 2500, createdAt: at(-0.5) },
    { _id: id(403), leilaoId: id(303), compradorId: id(2), valor: 1600, createdAt: at(-47.5) },
  ];

  const reviews = [
    { _id: id(501), autorId: id(2), encomendaId: id(201), produtoId: id(101), classificacao: 5, comentario: 'Produto de demonstração bem recebido.', estado: 'publicada' },
    { _id: id(502), autorId: id(2), encomendaId: id(201), produtorId: id(4), classificacao: 4, comentario: 'Avaliação fictícia do produtor.', estado: 'denunciada' },
  ];

  return [[User, users], [Product, products], [Order, orders], [Auction, auctions], [Bid, bids], [Review, reviews]];
}

export async function insertSeedData(dataset) {
  const counts = {};
  for (const [model, documents] of dataset) {
    let inserted = 0;
    for (const data of documents) {
      const document = new model(data);
      await document.validate();
      const { _id, ...values } = document.toObject();
      const now = new Date();
      const result = await model.updateOne({ _id }, {
        $setOnInsert: { ...values, createdAt: values.createdAt || now, updatedAt: values.updatedAt || now },
      }, { upsert: true, timestamps: false, setDefaultsOnInsert: false });
      inserted += result.upsertedCount;
    }
    counts[model.collection.name] = inserted;
  }
  return counts;
}
