import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { seedData, seedId, insertSeedData } from "../src/scripts/seed-data.js";
import {
  validateSeedData,
  checkExistingSeedData,
} from "../src/scripts/seed-validation.js";
import {
  User,
  Product,
  Order,
  Auction,
  Bid,
  Review,
} from "../src/models/index.js";

const hash = await bcrypt.hash("CampoMesaDemo123!", 4);
const fresh = () => seedData(hash, new Date("2026-10-15T12:00:00Z"));
const rows = (data, model) =>
  data.find(([candidate]) => candidate === model)[1];

test("Conjunto funcional cobre contagens, visibilidade, estados e médias dos filtros", async () => {
  const data = fresh();
  await validateSeedData(data);
  assert.ok(
    rows(data, Auction).some(
      (auction) =>
        auction.produtos.length > 1 &&
        new Set(auction.produtos.map((line) => line.unidade)).size > 1,
    ),
  );
  assert.deepEqual(
    data.map(([, docs]) => docs.length),
    [18, 39, 27, 12, 27, 38],
  );
  const users = rows(data, User);
  const approved = new Set(
    users
      .filter((u) => u.perfilProdutor?.validacao === "aceite")
      .map((u) => String(u._id)),
  );
  const products = rows(data, Product).slice(3);
  assert.equal(
    products.filter((p) => p.publicado && approved.has(String(p.produtorId)))
      .length,
    30,
  );
  assert.deepEqual([...new Set(products.map((p) => p.unidade))].sort(), [
    "g",
    "kg",
    "l",
    "unidade",
  ]);
  const averages = new Map();
  for (const review of rows(data, Review)
    .slice(2)
    .filter((r) => r.estado === "publicada" && r.produtoId)) {
    const key = String(review.produtoId);
    const ratings = averages.get(key) || [];
    ratings.push(review.classificacao);
    averages.set(key, ratings);
  }
  assert.deepEqual(
    [
      ...new Set(
        [...averages.values()].map(
          (a) => a.reduce((n, r) => n + r, 0) / a.length,
        ),
      ),
    ].sort(),
    [3, 3.5, 4, 4.5, 5],
  );
  for (const [model, field, expected] of [
    [Order, "estado", { entregue: 12, pendente: 4, confirmada: 4, pronta: 4 }],
    [Auction, "estado", { agendado: 6, terminado: 3 }],
    [Review, "estado", { publicada: 24, denunciada: 6, oculta: 6 }],
  ]) {
    const offset = model === Review ? 2 : 3;
    const counts = {};
    for (const row of rows(data, model).slice(offset))
      counts[row[field]] = (counts[row[field]] || 0) + 1;
    assert.deepEqual(counts, expected);
  }
});

test("Dados inválidos no fim do conjunto impedem qualquer escrita", async (t) => {
  const data = fresh();
  rows(data, Review).at(-1).classificacao = 9;
  let writes = 0;
  for (const [model] of data)
    t.mock.method(model, "updateOne", async () => {
      writes++;
    });
  await assert.rejects(insertSeedData(data), { name: "ValidationError" });
  assert.equal(writes, 0);
});

for (const target of ["produtoId", "produtorId"]) {
  for (const estado of ["publicada", "oculta", "denunciada"]) {
    test(`Seed recusa avaliação repetida de ${target} (${estado}) antes de criar índices ou escrever`, async (t) => {
      const data = fresh();
      const review = rows(data, Review).find((record) => record[target]);
      rows(data, Review).push({ ...review, _id: seedId(99999), estado });
      for (const [model] of data) {
        for (const method of [
          "find",
          "createCollection",
          "createIndexes",
          "updateOne",
        ]) {
          t.mock.method(model, method, () => {
            throw new Error(
              "Não deve consultar nem escrever antes da validação.",
            );
          });
        }
      }
      await assert.rejects(insertSeedData(data), {
        name: "SeedConflictError",
        message:
          "Seed incompatível: Avaliação repetida para o mesmo autor, encomenda e alvo.",
      });
    });
  }
}

test("Preflight recusa duplicados entre exemplos existentes e exemplos a inserir", async (t) => {
  const data = fresh();
  const reviews = rows(data, Review);
  const replacement = { ...reviews[0], _id: reviews[2]._id, estado: "oculta" };
  for (const [model] of data)
    t.mock.method(model, "find", () => ({
      select: () => ({
        lean: async () => (model === Review ? [replacement] : []),
      }),
    }));
  await assert.rejects(checkExistingSeedData(data), {
    name: "SeedConflictError",
    message:
      "Seed incompatível: Avaliação repetida para o mesmo autor, encomenda e alvo.",
  });
});

test("Validação rejeita IDs, emails, papéis, referências e históricos incompatíveis", async () => {
  const mutations = [
    (d) => {
      rows(d, Product)[0]._id = seedId(1);
    },
    (d) => {
      rows(d, User)[1].email = rows(d, User)[0].email;
    },
    (d) => {
      rows(d, Order)[0].compradorId = seedId(4);
    },
    (d) => {
      rows(d, Product)[0].produtorId = seedId(99999);
    },
    (d) => {
      rows(d, Review)[0].autorId = seedId(3);
    },
    (d) => {
      rows(d, Bid)[0].valor = 1;
    },
    (d) => {
      rows(d, Auction)[0].licitacaoAtual.compradorId = seedId(2);
    },
  ];
  for (const mutate of mutations) {
    const data = fresh();
    mutate(data);
    await assert.rejects(validateSeedData(data), { name: "SeedConflictError" });
  }
});

test("Preflight preserva alterações compatíveis e rejeita relações antigas incompatíveis", async (t) => {
  const data = fresh();
  const existing = new Map(data.map(([model]) => [model, []]));
  for (const [model] of data)
    t.mock.method(model, "find", (filter) => ({
      select: () => ({
        lean: async () => {
          if (filter.email) return [];
          return existing.get(model);
        },
      }),
    }));
  existing.set(User, [{ ...rows(data, User)[1], nome: "Nome personalizado" }]);
  existing.set(Product, [{ ...rows(data, Product)[0], stock: 7, preco: 999 }]);
  await checkExistingSeedData(data);
  existing.set(User, [{ ...rows(data, User)[1], papel: "administrador" }]);
  await assert.rejects(checkExistingSeedData(data), {
    name: "SeedConflictError",
  });
});

test("Preflight rejeita email ocupado por outro ID antes de escrever", async (t) => {
  const data = fresh();
  for (const [model] of data)
    t.mock.method(model, "find", (filter) => ({
      select: () => ({
        lean: async () =>
          filter.email
            ? [{ _id: seedId(99999), email: "ana@example.test" }]
            : [],
      }),
    }));
  await assert.rejects(checkExistingSeedData(data), {
    name: "SeedConflictError",
  });
});
