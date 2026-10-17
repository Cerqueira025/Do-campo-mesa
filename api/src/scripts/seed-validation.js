import { User, Product, Order, Auction, Bid, Review } from '../models/index.js';

const fail = (message) => { throw Object.assign(new Error(`Seed incompatível: ${message}`), { name: 'SeedConflictError' }); };
const same = (a, b) => String(a) === String(b);

export async function validateSeedData(dataset) {
  const records = new Map();
  const emails = new Set();
  for (const [model, documents] of dataset) {
    for (const data of documents) {
      await new model(data).validate();
      const key = String(data._id);
      if (records.has(key)) fail(`ID repetido ${key}.`);
      records.set(key, { model, data });
      if (model === User) {
        const email = data.email.trim().toLowerCase();
        if (emails.has(email)) fail('Email repetido.');
        emails.add(email);
      }
    }
  }
  const get = (id, model, role) => {
    const record = records.get(String(id));
    if (!record || record.model !== model || (role && record.data.papel !== role)) fail(`Referência inválida ${id}.`);
    return record.data;
  };
  for (const [model, documents] of dataset) {
    for (const data of documents) {
      if (model === Product) get(data.produtorId, User, 'produtor');
      if (model === Order) {
        get(data.compradorId, User, 'comprador');
        get(data.produtorId, User, 'produtor');
        for (const line of data.linhas) {
          if (!same(get(line.produtoId, Product).produtorId, data.produtorId)) fail('Encomenda mistura produtores.');
        }
        if (data.estado === 'entregue' && !data.dataEntrega) fail('Encomenda entregue sem data.');
        if (data.leilaoId) get(data.leilaoId, Auction);
      }
      if (model === Review) {
        get(data.autorId, User, 'comprador');
        const order = get(data.encomendaId, Order);
        if (order.estado !== 'entregue' || !same(order.compradorId, data.autorId)) fail('Avaliação sem compra elegível.');
        if (data.produtoId) {
          get(data.produtoId, Product);
          if (!order.linhas.some((line) => same(line.produtoId, data.produtoId))) fail('Produto avaliado fora da encomenda.');
        } else if (!same(order.produtorId, data.produtorId)) fail('Produtor avaliado fora da encomenda.');
      }
      if (model === Bid) {
        get(data.leilaoId, Auction);
        get(data.compradorId, User, 'comprador');
      }
      if (model === Auction) {
        get(data.produtorId, User, 'produtor');
        const product = get(data.produtoId, Product);
        if (!same(product.produtorId, data.produtorId) || product.unidade !== data.unidade) fail('Produto do leilão incompatível.');
        const bids = dataset.find(([candidate]) => candidate === Bid)[1]
          .filter((bid) => same(bid.leilaoId, data._id)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        let previous = data.precoBase;
        for (const bid of bids) {
          if (bid.valor < previous + data.incremento || new Date(bid.createdAt) <= new Date(data.dataInicio) ||
            new Date(bid.createdAt) >= new Date(data.dataFim)) fail('Histórico de licitações inválido.');
          previous = bid.valor;
        }
        const last = bids.at(-1);
        if (data.licitacaoAtual.valor !== previous || !same(data.licitacaoAtual.compradorId ?? null, last?.compradorId ?? null)) {
          fail('Licitação atual não corresponde ao histórico.');
        }
      }
    }
  }
}

export async function checkExistingSeedData(dataset) {
  const effective = [];
  for (const [model, documents] of dataset) {
    const existing = await model.find({ _id: { $in: documents.map((data) => data._id) } }).select('+passwordHash').lean();
    const byId = new Map(existing.map((data) => [String(data._id), data]));
    effective.push([model, documents.map((data) => byId.get(String(data._id)) || data)]);
    if (model === User) {
      const owners = await User.find({ email: { $in: documents.map((data) => data.email) } }).select('_id email').lean();
      for (const owner of owners) {
        if (!documents.some((data) => same(data._id, owner._id) && data.email === owner.email)) fail('Email já associado a outro documento.');
      }
    }
  }
  // Validate the relationships that will actually exist, including preserved documents.
  await validateSeedData(effective);
}
