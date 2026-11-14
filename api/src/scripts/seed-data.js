import mongoose from "mongoose";
import {
  User,
  Product,
  Order,
  Auction,
  Bid,
  Review,
  initializeCollections,
} from "../models/index.js";
import { validateSeedData, checkExistingSeedData } from "./seed-validation.js";

export const seedId = (number) =>
  new mongoose.Types.ObjectId(
    `dca000000000${number.toString(16).padStart(12, "0")}`,
  );

export function seedData(passwordHash, now = new Date()) {
  const id = seedId;
  const at = (hours) => new Date(now.getTime() + hours * 3600000);
  const profile = (validacao) => ({
    descricao: "Exploração fictícia para demonstração.",
    localidade: "Viana do Castelo",
    morada: "Morada de demonstração",
    coordenadas: { latitude: 41.6946, longitude: -8.8302 },
    validacao,
  });
  const users = [
    {
      _id: id(1),
      papel: "administrador",
      nome: "Admin Demo",
      email: "admin@example.test",
    },
    {
      _id: id(2),
      papel: "comprador",
      nome: "Ana Demo",
      email: "ana@example.test",
    },
    {
      _id: id(3),
      papel: "comprador",
      nome: "Restaurante Demo",
      email: "restaurante@example.test",
    },
    {
      _id: id(4),
      papel: "produtor",
      nome: "Quinta Demo",
      email: "produtor@example.test",
      perfilProdutor: profile("aceite"),
    },
    {
      _id: id(5),
      papel: "produtor",
      nome: "Produtor Pendente Demo",
      email: "pendente@example.test",
      perfilProdutor: profile("pendente"),
    },
    {
      _id: id(6),
      papel: "produtor",
      nome: "Produtor Rejeitado Demo",
      email: "rejeitado@example.test",
      perfilProdutor: profile("rejeitado"),
    },
  ].map((user) => ({ ...user, passwordHash }));

  const products = [
    {
      _id: id(101),
      nome: "Batata",
      categoria: "Hortícolas",
      preco: 150,
      unidade: "kg",
      stock: 80,
      epoca: ["verao", "outono"],
      biologico: true,
    },
    {
      _id: id(102),
      nome: "Maçã",
      categoria: "Fruta",
      preco: 240,
      unidade: "kg",
      stock: 40,
      epoca: ["outono"],
      biologico: false,
    },
    {
      _id: id(103),
      nome: "Mel",
      categoria: "Mel",
      preco: 700,
      unidade: "unidade",
      stock: 15,
      epoca: ["todo-o-ano"],
      biologico: true,
    },
  ].map((product) => ({
    ...product,
    produtorId: id(4),
    descricao: `${product.nome} de demonstração.`,
  }));

  const line = (product, quantidade) => ({
    produtoId: product._id,
    nome: product.nome,
    precoUnitario: product.preco,
    quantidade,
    unidade: product.unidade,
  });
  const orders = [
    {
      _id: id(201),
      compradorId: id(2),
      linhas: [line(products[0], 2), line(products[2], 1)],
      total: 1000,
      estado: "entregue",
      entrega: { tipo: "levantamento" },
      dataEntrega: at(-24),
    },
    {
      _id: id(202),
      compradorId: id(3),
      linhas: [line(products[1], 3)],
      total: 720,
      estado: "pendente",
      entrega: {
        tipo: "entrega",
        morada: "Restaurante de demonstração",
        dataPrevista: at(24),
      },
    },
    {
      _id: id(203),
      compradorId: id(2),
      linhas: [line(products[0], 1.5)],
      total: 225,
      estado: "pronta",
      entrega: { tipo: "levantamento", dataPrevista: at(12) },
    },
  ].map((order) => ({ ...order, produtorId: id(4), leilaoId: null }));

  const auctions = [
    {
      _id: id(301),
      lote: "Lote de batata agendado",
      quantidade: 10,
      precoBase: 1000,
      incremento: 100,
      dataInicio: at(24),
      dataFim: at(25),
      estado: "agendado",
      licitacaoAtual: { valor: 1000, compradorId: null },
    },
    {
      _id: id(302),
      lote: "Lote de batata ativo",
      quantidade: 20,
      precoBase: 2000,
      incremento: 100,
      dataInicio: at(-1),
      dataFim: at(1),
      estado: "ativo",
      licitacaoAtual: { valor: 2500, compradorId: id(3) },
    },
    {
      _id: id(303),
      lote: "Lote de batata terminado",
      quantidade: 10,
      precoBase: 1000,
      incremento: 100,
      dataInicio: at(-48),
      dataFim: at(-47),
      estado: "terminado",
      licitacaoAtual: { valor: 1600, compradorId: id(2) },
    },
  ].map(({ quantidade, ...auction }) => ({
    ...auction,
    produtorId: id(4),
    produtos: [{ produtoId: id(101), quantidade, unidade: "kg" }],
  }));

  const bids = [
    {
      _id: id(401),
      leilaoId: id(302),
      compradorId: id(2),
      valor: 2100,
      createdAt: at(-0.8),
    },
    {
      _id: id(402),
      leilaoId: id(302),
      compradorId: id(3),
      valor: 2500,
      createdAt: at(-0.5),
    },
    {
      _id: id(403),
      leilaoId: id(303),
      compradorId: id(2),
      valor: 1600,
      createdAt: at(-47.5),
    },
  ];

  const reviews = [
    {
      _id: id(501),
      autorId: id(2),
      encomendaId: id(201),
      produtoId: id(101),
      classificacao: 5,
      comentario: "Produto de demonstração bem recebido.",
      estado: "publicada",
    },
    {
      _id: id(502),
      autorId: id(2),
      encomendaId: id(201),
      produtorId: id(4),
      classificacao: 4,
      comentario: "Avaliação fictícia do produtor.",
      estado: "denunciada",
    },
  ];

  const locations = [
    ["Viana do Castelo", 41.6946, -8.8302],
    ["Braga", 41.5454, -8.4265],
    ["Ponte de Lima", 41.7672, -8.5839],
  ];
  for (let i = 0; i < 6; i++) {
    users.push({
      _id: id(1001 + i),
      papel: "comprador",
      nome: `Comprador Funcional ${i + 1}`,
      email: `comprador${i + 1}@example.test`,
      passwordHash,
    });
    const [localidade, latitude, longitude] = locations[i % 3];
    users.push({
      _id: id(1101 + i),
      papel: "produtor",
      nome: `Quinta Funcional ${i + 1}`,
      email: `quinta${i + 1}@example.test`,
      passwordHash,
      perfilProdutor: {
        ...profile(i < 4 ? "aceite" : i === 4 ? "pendente" : "rejeitado"),
        localidade,
        coordenadas: { latitude, longitude },
      },
    });
  }
  const varieties = [
    ["Batata", "Hortícolas", "kg", 151],
    ["Maçã", "Fruta", "kg", 240],
    ["Mel", "Mel", "g", 2],
    ["Azeite", "Azeite", "l", 899],
    ["Leite", "Laticínios", "l", 110],
    ["Vinho", "Bebidas", "unidade", 1250],
    ["Cenoura", "Hortícolas", "kg", 135],
    ["Pera", "Fruta", "kg", 275],
    ["Ovos", "Ovos", "unidade", 35],
    ["Nozes", "Frutos secos", "g", 3],
  ];
  const extraProducts = Array.from({ length: 36 }, (_, i) => {
    const [nome, categoria, unidade, preco] = varieties[i % 10];
    return {
      _id: id(2001 + i),
      produtorId: id(
        1101 + (i < 30 ? Math.floor(i / 10) : i < 32 ? 0 : i < 34 ? 4 : 5),
      ),
      nome,
      categoria,
      unidade,
      preco,
      descricao: `${nome} da exploração funcional ${i + 1}.`,
      stock: i % 10 === 8 ? 0 : unidade === "g" ? 100 + i : 40 + i,
      epoca: [
        ["primavera"],
        ["verao"],
        ["outono"],
        ["inverno"],
        ["todo-o-ano"],
      ][i % 5],
      biologico: i % 2 === 0,
      publicado: i !== 30 && i !== 31,
      createdAt: at(-200 + i),
      updatedAt: at(-200 + i),
    };
  });
  products.push(...extraProducts);
  const catalogProducts = [
    [
      1101,
      "Abóbora",
      "Hortícolas",
      "kg",
      180,
      40,
      ["outono"],
      "Abóbora de outono para assar ou usar em sopas.",
    ],
    [
      1101,
      "Alho",
      "Hortícolas",
      "kg",
      450,
      20,
      ["verao"],
      "Cabeças de alho seco para temperar.",
    ],
    [
      1101,
      "Brócolos",
      "Hortícolas",
      "kg",
      280,
      30,
      ["inverno"],
      "Brócolos frescos para cozer ou saltear.",
    ],
    [
      1101,
      "Cebola",
      "Hortícolas",
      "kg",
      170,
      45,
      ["verao"],
      "Cebola seca para refogados e assados.",
    ],
    [
      1101,
      "Tomate",
      "Hortícolas",
      "kg",
      240,
      35,
      ["verao"],
      "Tomate maduro para saladas e molhos.",
    ],
    [
      1102,
      "Cereja",
      "Fruta",
      "kg",
      550,
      25,
      ["primavera", "verao"],
      "Cerejas frescas para comer ao natural.",
    ],
    [
      1102,
      "Laranja",
      "Fruta",
      "kg",
      190,
      50,
      ["inverno"],
      "Laranjas de inverno para sumo ou sobremesa.",
    ],
    [
      1102,
      "Morango",
      "Fruta",
      "kg",
      420,
      25,
      ["primavera"],
      "Morangos de primavera para servir frescos.",
    ],
    [
      1103,
      "Pão",
      "Padaria",
      "unidade",
      220,
      20,
      ["todo-o-ano"],
      "Pão de trigo com côdea crocante.",
    ],
  ];
  products.push(
    ...catalogProducts.map(
      (
        [produtor, nome, categoria, unidade, preco, stock, epoca, descricao],
        i,
      ) => ({
        _id: id(2037 + i),
        produtorId: id(produtor),
        nome,
        categoria,
        unidade,
        preco,
        stock,
        epoca,
        descricao,
        biologico: false,
        publicado: true,
      }),
    ),
  );
  for (let i = 0; i < 24; i++) {
    const group = i % 3;
    const pair = Math.floor((i % 12) / 3) % 2;
    const selected = extraProducts.slice(
      group * 10 + pair * 2,
      group * 10 + pair * 2 + 2,
    );
    const linhas = selected.map((product, j) => ({
      ...line(product, product.unidade === "g" ? 100 : j ? 1.5 : 0.5),
      precoUnitario: product.preco + 1,
    }));
    orders.push({
      _id: id(3001 + i),
      compradorId: id(1001 + (i % 6)),
      produtorId: id(1101 + group),
      linhas,
      total: linhas.reduce(
        (sum, item) => sum + Math.round(item.precoUnitario * item.quantidade),
        0,
      ),
      estado:
        i < 12
          ? "entregue"
          : ["pendente", "confirmada", "pronta"][Math.floor((i - 12) / 4)],
      entrega:
        i % 2
          ? {
              tipo: "entrega",
              morada: `Morada fictícia ${i + 1}`,
              dataPrevista: at(i < 12 ? -24 : 24),
            }
          : { tipo: "levantamento", dataPrevista: at(i < 12 ? -24 : 24) },
      ...(i < 12 ? { dataEntrega: at(-24) } : {}),
      leilaoId: null,
      createdAt: at(-72),
      updatedAt: at(-24),
    });
  }
  for (let i = 0; i < 9; i++) {
    const product = extraProducts[(i % 3) * 10];
    const estado = ["agendado", "ativo", "terminado"][Math.floor(i / 3)];
    const start = i < 3 ? 24 : i < 6 ? -12 : -48;
    const end = i < 3 ? 48 : i < 6 ? 24 : -24;
    const auction = {
      _id: id(4001 + i),
      produtorId: product.produtorId,
      produtos: [
        { produtoId: product._id, quantidade: 2, unidade: product.unidade },
      ],
      lote: `Lote funcional ${i + 1}`,
      precoBase: 1000,
      incremento: 100,
      dataInicio: at(start),
      dataFim: at(end),
      estado,
      licitacaoAtual: { valor: 1000, compradorId: null },
    };
    if (i === 3) {
      const second = extraProducts[2];
      auction.produtos.push({
        produtoId: second._id,
        quantidade: 10,
        unidade: second.unidade,
      });
    }
    if ([3, 4, 6, 7].includes(i)) {
      for (let j = 0; j < 6; j++) {
        const bid = {
          _id: id(5001 + bids.length - 3),
          leilaoId: auction._id,
          compradorId: id(1001 + j),
          valor: 1100 + j * 100,
          createdAt: at(start + j + 1),
        };
        bids.push(bid);
        auction.licitacaoAtual = {
          valor: bid.valor,
          compradorId: bid.compradorId,
        };
      }
    }
    auctions.push(auction);
  }
  // Two public product reviews per delivered order; producer reviews exercise moderation.
  const ratings = [
    [3, 3],
    [3, 4],
    [4, 4],
    [4, 5],
    [5, 5],
    [3, 3],
  ];
  for (let i = 0; i < 12; i++) {
    const order = orders[3 + i];
    for (let j = 0; j < 3; j++) {
      reviews.push({
        _id: id(6001 + i * 3 + j),
        autorId: order.compradorId,
        encomendaId: order._id,
        ...(j < 2
          ? { produtoId: order.linhas[j].produtoId }
          : { produtorId: order.produtorId }),
        classificacao: j < 2 ? ratings[i % 6][Math.floor(i / 6)] : 4,
        comentario: `Avaliação funcional ${i + 1}/${j + 1}.`,
        estado: j < 2 ? "publicada" : i % 2 ? "oculta" : "denunciada",
        createdAt: at(-12),
      });
    }
  }

  for (const auction of auctions) {
    const ended = auction.estado === "terminado";
    auction.reservaStock = ended ? "sem-reserva" : "pendente";
    if (!ended) auction.estado = "agendado";
  }
  return [
    [User, users],
    [Product, products],
    [Order, orders],
    [Auction, auctions],
    [Bid, bids],
    [Review, reviews],
  ];
}

export async function insertSeedData(dataset) {
  await validateSeedData(dataset);
  await checkExistingSeedData(dataset);
  await initializeCollections();
  const counts = {};
  for (const [model, documents] of dataset) {
    let inserted = 0;
    for (const data of documents) {
      const document = new model(data);
      await document.validate();
      const { _id, ...values } = document.toObject();
      const now = new Date();
      const result = await model.updateOne(
        { _id },
        {
          $setOnInsert: {
            ...values,
            createdAt: values.createdAt || now,
            updatedAt: values.updatedAt || now,
          },
        },
        { upsert: true, timestamps: false, setDefaultsOnInsert: false },
      );
      inserted += result.upsertedCount;
    }
    counts[model.collection.name] = inserted;
  }
  return counts;
}
