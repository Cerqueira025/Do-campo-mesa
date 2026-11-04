import test from "node:test";
import assert from "node:assert/strict";
import {
  auctionPayload,
  eligibleAuctionProducts,
  type AuctionDraft,
} from "../src/features/auctions/creation.ts";
import type { ProducerProduct } from "../src/features/products/management.ts";

const product: ProducerProduct = {
  _id: "dca000000000000000000065",
  nome: "Batata",
  descricao: "Local",
  categoria: "Hortícolas",
  preco: 150,
  unidade: "kg",
  stock: 5,
  epoca: [],
  biologico: false,
  publicado: true,
  bloqueado: false,
  createdAt: "",
  updatedAt: "",
};
const oil: ProducerProduct = {
  ...product,
  _id: "dca000000000000000000066",
  nome: "Azeite",
  unidade: "l",
};
const now = new Date(2027, 0, 1, 10).getTime();
function draft(): AuctionDraft {
  return {
    produtos: [{ key: 0, produtoId: product._id, quantidade: "2" }],
    lote: " Cabaz da horta ",
    precoBase: "10,25",
    incremento: "0.50",
    inicio: "agora",
    dataInicio: "",
    dataFim: "2027-01-01T12:00",
  };
}

test("Cria um produto ou cabaz, converte euros e usa a hora da submissão", () => {
  const body = auctionPayload(draft(), [product], now);
  assert.equal(body.lote, "Cabaz da horta");
  assert.equal(body.precoBase, 1025);
  assert.equal(body.incremento, 50);
  assert.equal(body.dataInicio, new Date(now).toISOString());
  assert.equal(body.dataFim, new Date(2027, 0, 1, 12).toISOString());
  assert.deepEqual(body.produtos, [{ produtoId: product._id, quantidade: 2 }]);
  assert.equal(
    auctionPayload(draft(), [product], now + 1000).dataInicio,
    new Date(now + 1000).toISOString(),
  );
  const basket = draft();
  basket.produtos.push({ key: 1, produtoId: oil._id, quantidade: "0,5" });
  assert.deepEqual(auctionPayload(basket, [product, oil], now).produtos, [
    { produtoId: product._id, quantidade: 2 },
    { produtoId: oil._id, quantidade: 0.5 },
  ]);
});

test("Aceita preço base zero e converte datas locais de um agendamento", () => {
  const body = auctionPayload(
    {
      ...draft(),
      inicio: "agendado",
      dataInicio: "2027-01-01T11:00",
      precoBase: "0,00",
    },
    [product],
    now,
  );
  assert.equal(body.precoBase, 0);
  assert.equal(body.dataInicio, new Date(2027, 0, 1, 11).toISOString());
});

test("Exclui produtos despublicados, bloqueados ou sem stock e recusa a sua submissão", () => {
  for (const change of [
    { publicado: false },
    { bloqueado: true },
    { stock: 0 },
  ]) {
    const unavailable = { ...product, ...change };
    assert.deepEqual(eligibleAuctionProducts([unavailable, oil]), [oil]);
    assert.throws(
      () => auctionPayload(draft(), [unavailable], now),
      /disponível/,
    );
  }
});

test("Recusa lote vazio, seleção em falta, produtos repetidos e quantidades inválidas", () => {
  assert.throws(() =>
    auctionPayload({ ...draft(), lote: " " }, [product], now),
  );
  assert.throws(() =>
    auctionPayload({ ...draft(), produtos: [] }, [product], now),
  );
  assert.throws(() =>
    auctionPayload(
      { ...draft(), produtos: [{ key: 0, produtoId: "", quantidade: "1" }] },
      [product],
      now,
    ),
  );
  assert.throws(
    () =>
      auctionPayload(
        { ...draft(), produtos: [...draft().produtos, ...draft().produtos] },
        [product],
        now,
      ),
    /repetir/,
  );
  for (const quantidade of [
    "",
    "0",
    "-1",
    "0.1",
    "6",
    "Infinity",
    "1e3",
    "NaN",
  ]) {
    assert.throws(
      () =>
        auctionPayload(
          {
            ...draft(),
            produtos: [{ key: 0, produtoId: product._id, quantidade }],
          },
          [product],
          now,
        ),
      /quantidade/,
    );
  }
  for (const [unidade, quantidade] of [
    ["unidade", "1.5"],
    ["g", "150"],
  ] as const) {
    assert.throws(() =>
      auctionPayload(
        {
          ...draft(),
          produtos: [{ key: 0, produtoId: product._id, quantidade }],
        },
        [{ ...product, unidade, stock: 1000 }],
        now,
      ),
    );
  }
});

test("Recusa montantes negativos, precisão excessiva, incremento zero e limites inseguros", () => {
  for (const field of ["precoBase", "incremento"] as const) {
    for (const value of [
      "",
      "-1",
      "1.001",
      "1e3",
      "Infinity",
      "9007199254740992",
    ]) {
      assert.throws(() =>
        auctionPayload({ ...draft(), [field]: value }, [product], now),
      );
    }
  }
  assert.throws(() =>
    auctionPayload({ ...draft(), incremento: "0" }, [product], now),
  );
  assert.throws(() =>
    auctionPayload(
      { ...draft(), precoBase: "90071992547409.90", incremento: "0.02" },
      [product],
      now,
    ),
  );
});

test("Recusa início agendado no passado, datas inválidas e fim não posterior", () => {
  for (const dataInicio of [
    "",
    "inválida",
    "2027-01-01T09:00",
    "2027-01-01T10:00",
    "2027-01-01T12:00",
  ]) {
    assert.throws(() =>
      auctionPayload(
        { ...draft(), inicio: "agendado", dataInicio },
        [product],
        now,
      ),
    );
  }
  for (const dataFim of [
    "",
    "inválida",
    "2027-01-01T09:00",
    "2027-01-01T10:00",
  ]) {
    assert.throws(() =>
      auctionPayload({ ...draft(), dataFim }, [product], now),
    );
  }
});
