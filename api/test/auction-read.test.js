import test from "node:test";
import assert from "node:assert/strict";
import router from "../src/routes/auctions.js";
import Auction from "../src/models/Auction.js";
import Order from "../src/models/Order.js";
import User from "../src/models/User.js";

const handler = (path) =>
  router.stack
    .find((layer) => layer.route?.path === path && layer.route.methods.get)
    .route.stack.at(-1).handle;
const id = "dca000000000000000004001";
const producerId = "dca000000000000000000004";
const now = Date.parse("2026-10-18T12:00:00Z");
const valid = {
  _id: id,
  estado: "ativo",
  reservaStock: "reservada",
  licitacaoAtual: { valor: 100, compradorId: null },
  dataInicio: new Date(now - 1000),
  dataFim: new Date(now + 1000),
  produtos: [
    {
      produtoId: { nome: "Azeite", publicado: true, produtorId: producerId },
      quantidade: 2,
      unidade: "l",
    },
  ],
  produtorId: {
    _id: producerId,
    nome: "Quinta",
    papel: "produtor",
    perfilProdutor: { validacao: "aceite" },
  },
};

// Simula os operadores Mongo usados nas consultas, incluindo os matches de populate.
function matches(record, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some((branch) => matches(record, branch));
    if (key === "$nor") return !value.some((branch) => matches(record, branch));
    const actual = key
      .split(".")
      .reduce((result, part) => result?.[part], record);
    if (!value || typeof value !== "object") return actual === value;
    return Object.entries(value).every(([operator, expected]) => {
      if (operator === "$ne") return actual !== expected;
      if (operator === "$nin") return !expected.includes(actual);
      if (operator === "$gt") return actual > expected;
      if (operator === "$lte") return actual <= expected;
      throw new Error(`Operador não suportado: ${operator}`);
    });
  });
}

function populated(value) {
  const options = [];
  return {
    sort() {
      return this;
    },
    populate(option) {
      options.push(option);
      return this;
    },
    async lean() {
      function populate(record) {
        if (!record) return null;
        const result = structuredClone(record);
        for (const option of options) {
          assert.equal(option.select.includes("passwordHash"), false);
          assert.equal(option.select.includes("imagens"), false);
          if (option.path === "produtos.produtoId") {
            for (const line of result.produtos || []) {
              if (!line.produtoId || !matches(line.produtoId, option.match))
                line.produtoId = null;
            }
          } else if (
            !result[option.path] ||
            !matches(result[option.path], option.match)
          )
            result[option.path] = null;
        }
        return result;
      }
      return Array.isArray(value) ? value.map(populate) : populate(value);
    },
  };
}

function setup(t, records) {
  t.mock.method(Date, "now", () => now);
  t.mock.method(Auction, "find", (filter) =>
    populated(records.filter((record) => matches(record, filter))),
  );
  t.mock.method(Auction, "findById", (value) =>
    populated(records.find((record) => record._id === value) ?? null),
  );
  t.mock.method(Order, "findOne", () => ({
    select() {
      return this;
    },
    async lean() {
      return { _id: "dca000000000000000000099" };
    },
  }));
  t.mock.method(User, "findById", () => ({
    select() {
      return this;
    },
    async lean() {
      return { nome: "Ana" };
    },
  }));
  for (const method of ["create", "updateMany", "findByIdAndUpdate"]) {
    t.mock.method(Auction, method, () => {
      throw new Error("GET não deve escrever.");
    });
  }
}

async function invoke(path, query = {}, value = id) {
  const response = {
    code: 200,
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  await handler(path)({ params: { id: value }, query }, response, (error) => {
    throw error;
  });
  return response;
}

test("Lista e detalhe corrigem o estado guardado sem alterar documentos nem expor o campo auxiliar", async (t) => {
  const records = [structuredClone(valid)];
  const original = structuredClone(records);
  setup(t, records);
  const list = (await invoke("/", { estado: "ativo" })).body;
  const detail = await invoke("/:id");
  assert.equal(detail.code, 200);
  assert.equal(list.length, 1);
  assert.equal(list[0].estado, "ativo");
  assert.deepEqual(list[0], detail.body);
  assert.equal(detail.body.produtos[0].produtoId.produtorId, undefined);
  assert.deepEqual(records, original);
});

test("Filtros e respostas seguem os limites das datas e respeitam término explícito", async (t) => {
  const records = [
    {
      ...valid,
      _id: "before-start",
      estado: "agendado",
      reservaStock: "pendente",
      dataInicio: new Date(now + 1),
    },
    { ...valid, _id: "at-start", dataInicio: new Date(now) },
    { ...valid, _id: "active-before-start", dataInicio: new Date(now + 1) },
    { ...valid, _id: "before-end", dataFim: new Date(now + 1) },
    { ...valid, _id: "at-end", dataFim: new Date(now) },
    { ...valid, _id: "after-end", dataFim: new Date(now - 1) },
    {
      ...valid,
      _id: "explicit-end",
      estado: "terminado",
      dataInicio: new Date(now + 1),
    },
  ];
  setup(t, records);
  const expected = {
    agendado: ["before-start", "active-before-start"],
    ativo: ["at-start", "before-end"],
    terminado: ["at-end", "after-end", "explicit-end"],
  };
  for (const [estado, ids] of Object.entries(expected)) {
    const response = await invoke("/", { estado });
    assert.deepEqual(
      response.body.map((record) => record._id),
      ids,
    );
    assert.ok(response.body.every((record) => record.estado === estado));
  }
  assert.equal((await invoke("/")).body.length, records.length);
});

test("A passagem do tempo não ativa um leilão sem reserva confirmada", async (t) => {
  const record = {
    ...structuredClone(valid),
    estado: "agendado",
    reservaStock: "pendente",
  };
  setup(t, [record]);
  for (const time of [now - 1001, now - 1000, now]) {
    t.mock.method(Date, "now", () => time);
    assert.equal((await invoke("/:id")).body.estado, "agendado");
    assert.equal((await invoke("/", { estado: "ativo" })).body.length, 0);
  }
  record.estado = "ativo";
  record.reservaStock = "reservada";
  assert.equal((await invoke("/:id")).body.estado, "ativo");
  t.mock.method(Date, "now", () => now + 1000);
  const ended = await invoke("/:id");
  assert.equal(ended.body.estado, "terminado");
  assert.deepEqual(ended.body.resultado, {
    vencedor: false,
    vencedorId: null,
    vencedorNome: null,
    valor: 100,
    encomendaId: null,
  });
});

const unavailable = {
  "produto apagado": {
    ...valid,
    produtos: [{ ...valid.produtos[0], produtoId: null }],
  },
  "produto despublicado": {
    ...valid,
    produtos: [
      {
        ...valid.produtos[0],
        produtoId: { ...valid.produtos[0].produtoId, publicado: false },
      },
    ],
  },
  "produto de outro produtor": {
    ...valid,
    produtos: [
      {
        ...valid.produtos[0],
        produtoId: { ...valid.produtos[0].produtoId, produtorId: "outro" },
      },
    ],
  },
  "produtor removido": { ...valid, produtorId: null },
  "produtor pendente": {
    ...valid,
    produtorId: {
      ...valid.produtorId,
      perfilProdutor: { validacao: "pendente" },
    },
  },
  "produtor rejeitado": {
    ...valid,
    produtorId: {
      ...valid.produtorId,
      perfilProdutor: { validacao: "rejeitado" },
    },
  },
  "conta sem papel produtor": {
    ...valid,
    produtorId: { ...valid.produtorId, papel: "comprador" },
  },
};
for (const [reason, record] of Object.entries(unavailable)) {
  test(`Omite da lista e devolve 404 no detalhe para ${reason}`, async (t) => {
    setup(t, [record]);
    assert.deepEqual((await invoke("/")).body, []);
    assert.equal((await invoke("/:id")).code, 404);
  });
}

test("Uma referência indisponível não impede a listagem dos restantes leilões", async (t) => {
  setup(t, [...Object.values(unavailable), valid]);
  assert.equal((await invoke("/")).body.length, 1);
});

test("Lote misto exige todos os produtos disponíveis, incluindo o segundo", async (t) => {
  const record = structuredClone(valid);
  record.produtos.push({
    produtoId: { ...record.produtos[0].produtoId, nome: "Mel" },
    quantidade: 3,
    unidade: "unidade",
  });
  setup(t, [record]);
  assert.equal((await invoke("/:id")).body.produtos.length, 2);
  record.produtos[1].produtoId = null;
  assert.equal((await invoke("/:id")).code, 404);
  assert.deepEqual((await invoke("/")).body, []);
});

test("Leilão terminado continua público se os alvos estiverem disponíveis", async (t) => {
  setup(t, [{ ...valid, estado: "terminado" }]);
  const detail = await invoke("/:id");
  const list = await invoke("/", { estado: "terminado" });
  assert.equal(detail.code, 200);
  assert.equal(detail.body.estado, "terminado");
  assert.deepEqual(detail.body.resultado, {
    vencedor: false,
    vencedorId: null,
    vencedorNome: null,
    valor: 100,
    encomendaId: null,
  });
  assert.deepEqual(
    list.body.map(({ _id, estado }) => ({ _id, estado })),
    [{ _id: id, estado: "terminado" }],
  );
});

test("Detalhe persiste o resultado e a encomenda de um leilão terminado com vencedor", async (t) => {
  const record = {
    ...structuredClone(valid),
    estado: "terminado",
    reservaStock: "atribuida",
    licitacaoAtual: { valor: 2500, compradorId: "dca000000000000000000002" },
  };
  setup(t, [record]);
  const detail = await invoke("/:id");
  assert.deepEqual(detail.body.resultado, {
    vencedor: true,
    vencedorId: "dca000000000000000000002",
    vencedorNome: "Ana",
    valor: 2500,
    encomendaId: "dca000000000000000000099",
  });
});

test("Detalhe identifica leilão terminado sem vencedor sem criar resultado de encomenda", async (t) => {
  const record = {
    ...structuredClone(valid),
    estado: "terminado",
    reservaStock: "sem-reserva",
    licitacaoAtual: { valor: 1000, compradorId: null },
  };
  setup(t, [record]);
  const detail = await invoke("/:id");
  assert.deepEqual(detail.body.resultado, {
    vencedor: false,
    vencedorId: null,
    vencedorNome: null,
    valor: 1000,
    encomendaId: null,
  });
});

test("Cancelamento prevalece sobre as datas e é consultável com o motivo", async (t) => {
  setup(t, [
    {
      ...valid,
      estado: "cancelado",
      reservaStock: "sem-reserva",
      motivoCancelamento: "stock-insuficiente",
      dataFim: new Date(now - 1),
    },
  ]);
  const cancelled = (await invoke("/", { estado: "cancelado" })).body;
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].motivoCancelamento, "stock-insuficiente");
  assert.equal((await invoke("/:id")).body.estado, "cancelado");
  assert.deepEqual((await invoke("/", { estado: "terminado" })).body, []);
  assert.deepEqual((await invoke("/", { estado: "ativo" })).body, []);
});

for (const estado of ["agendado", "ativo", "terminado"]) {
  test(`A aprovação atual oculta e repõe o leilão ${estado} sem alterar os documentos`, async (t) => {
    const record = structuredClone(valid);
    record.estado = estado;
    record.reservaStock =
      estado === "agendado"
        ? "pendente"
        : estado === "ativo"
          ? "reservada"
          : "atribuida";
    if (estado === "agendado") record.dataInicio = new Date(now + 1);
    const original = structuredClone(record);
    setup(t, [record]);
    for (const validacao of ["pendente", "aceite", "rejeitado", "aceite"]) {
      record.produtorId.perfilProdutor.validacao = validacao;
      const visible = validacao === "aceite";
      assert.equal(
        (await invoke("/", { estado })).body.length,
        visible ? 1 : 0,
      );
      assert.equal((await invoke("/:id")).code, visible ? 200 : 404);
      assert.deepEqual(record, {
        ...original,
        produtorId: { ...original.produtorId, perfilProdutor: { validacao } },
      });
    }
  });
}

test("Lista vazia e leilão inexistente mantêm os contratos", async (t) => {
  setup(t, []);
  assert.deepEqual((await invoke("/")).body, []);
  assert.equal((await invoke("/:id")).code, 404);
});

test("ID e estados inválidos são rejeitados antes de consultar a base", async (t) => {
  t.mock.method(Auction, "findById", () => {
    throw new Error("Não consultar.");
  });
  t.mock.method(Auction, "find", () => {
    throw new Error("Não consultar.");
  });
  assert.equal((await invoke("/:id", {}, "invalido")).code, 404);
  for (const estado of ["", "desconhecido", ["ativo", "agendado"], {}, null]) {
    assert.equal((await invoke("/", { estado })).code, 400);
  }
});
