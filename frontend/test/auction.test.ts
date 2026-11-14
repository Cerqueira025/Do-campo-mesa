import test from "node:test";
import assert from "node:assert/strict";
import {
  auctionHref,
  auctionState,
  bidInputValue,
  upcomingAuctions,
  formatRemaining,
  isAuction,
  parseBid,
  remainingSeconds,
  serverClockOffset,
  type Auction,
} from "../src/features/auctions/auction.ts";
import { auctionIdFromPath } from "../src/navigation/routePaths.ts";
import { catalogReturnUrl } from "../src/features/products/product.ts";

const id = "dca000000000000000004001";
const now = Date.parse("2026-10-15T12:00:00Z");
const auction: Auction = {
  _id: id,
  produtos: [
    { produtoId: { nome: "Azeite" }, quantidade: 12, unidade: "unidade" },
  ],
  lote: "12 garrafas",
  incremento: 500,
  licitacaoAtual: { valor: 8400 },
  estado: "ativo",
  reservaStock: "reservada",
  dataInicio: "2026-10-15T11:00:00Z",
  dataFim: "2026-10-15T13:00:00Z",
};

test("Agrupa os leilões públicos e ordena os agendados pela data de início", () => {
  const later: Auction = {
    ...auction,
    estado: "agendado",
    reservaStock: "pendente",
    dataInicio: "2026-10-15T14:00:00Z",
    dataFim: "2026-10-15T15:00:00Z",
  };
  const sooner = { ...later, dataInicio: "2026-10-15T13:00:00Z" };
  assert.deepEqual(upcomingAuctions([later, auction, sooner], now), {
    active: [auction],
    scheduled: [sooner, later],
  });
  assert.deepEqual(upcomingAuctions([], now), { active: [], scheduled: [] });
});

test("Resolve rotas de leilões e preserva o regresso com pesquisa e filtros", () => {
  assert.equal(auctionIdFromPath(`/leiloes/${id}`), id);
  assert.equal(auctionIdFromPath(`/leiloes/${id}/`), id);
  for (const path of [
    "/leiloes",
    "/leiloes/invalido",
    `/leiloes/${id}/extra`,
    `/produtos/${id}`,
  ]) {
    assert.equal(auctionIdFromPath(path), null);
  }
  const catalog = "/?q=azeite&bio=true";
  const href = new URL(auctionHref(id, catalog), "https://example.test");
  assert.equal(catalogReturnUrl(href.search), catalog);
  assert.equal(auctionHref(id), `/leiloes/${id}`);
  assert.equal(catalogReturnUrl("?regresso=//evil.test"), "/");
});

test("Converte montantes em cêntimos sem aceitar formatos ambíguos ou precisão excessiva", () => {
  for (const [input, expected] of [
    ["89,00", 8900],
    ["89.5", 8950],
    ["89", 8900],
    ["0,01", 1],
    [" 94,25 ", 9425],
  ] as const) {
    assert.equal(parseBid(input), expected);
    assert.equal(parseBid(bidInputValue(expected)), expected);
  }
  for (const input of [
    "",
    "0",
    "-5",
    "1,234",
    "1e3",
    "1.000,50",
    "Infinity",
    "9 0",
    "9007199254740992",
  ]) {
    assert.equal(parseBid(input), null);
  }
  assert.equal(
    bidInputValue(auction.licitacaoAtual.valor + auction.incremento),
    "89,00",
  );
});

test("Aplica datas nos limites de início e fim e respeita o término explícito", () => {
  assert.equal(
    auctionState(auction, Date.parse(auction.dataInicio) - 1),
    "agendado",
  );
  assert.equal(auctionState(auction, Date.parse(auction.dataInicio)), "ativo");
  assert.equal(auctionState(auction, Date.parse(auction.dataFim) - 1), "ativo");
  assert.equal(auctionState(auction, Date.parse(auction.dataFim)), "terminado");
  assert.equal(
    auctionState({ ...auction, estado: "terminado" }, now),
    "terminado",
  );
  assert.equal(remainingSeconds(now + 1, now), 1);
  assert.equal(remainingSeconds(now - 1, now), 0);
  assert.equal(formatRemaining(1122), "18:42");
  assert.equal(formatRemaining(3601), "01:00:01");
  assert.equal(formatRemaining(0), "00:00");
});

test("Sincroniza o relógio local com Date do servidor e usa zero como fallback", () => {
  const local = Date.parse("2026-10-15T12:00:10Z");
  assert.equal(
    serverClockOffset("Thu, 15 Oct 2026 12:00:00 GMT", local),
    -10_000,
  );
  assert.equal(
    serverClockOffset("Thu, 15 Oct 2026 12:00:20 GMT", local),
    10_000,
  );
  assert.equal(serverClockOffset(null, local), 0);
  assert.equal(serverClockOffset("invalid", local), 0);
  const end = local + 30_000;
  assert.equal(remainingSeconds(end, local - 10_000), 40);
  assert.equal(remainingSeconds(end, local + 10_000), 20);
});

test("Seleciona o leilão em curso com fim mais próximo, sem alterar a lista recebida", () => {
  const sooner = {
    ...auction,
    _id: "dca000000000000000004002",
    dataFim: "2026-10-15T12:30:00Z",
  };
  const list = [
    auction,
    { ...auction, estado: "terminado" as const },
    sooner,
    { ...auction, dataInicio: "2026-10-15T12:20:00Z" },
    { ...auction, dataFim: "2026-10-15T11:30:00Z" },
  ];
  assert.equal(upcomingAuctions(list, now).active[0] ?? null, sooner);
  assert.equal(list[0], auction);
  assert.equal(upcomingAuctions([], now).active[0] ?? null, null);
  assert.equal(
    upcomingAuctions([auction], Date.parse(auction.dataFim)).active[0] ?? null,
    null,
  );
});

test("Rejeita respostas sem produto, datas válidas ou montantes inteiros seguros", () => {
  assert.equal(isAuction(auction), true);
  for (const value of [
    null,
    {},
    { ...auction, produtos: [{ ...auction.produtos[0], produtoId: null }] },
    { ...auction, incremento: 0 },
    { ...auction, dataFim: "inválida" },
    { ...auction, dataFim: auction.dataInicio },
    { ...auction, estado: "desconhecido" },
    { ...auction, licitacaoAtual: { valor: 84.5 } },
    { ...auction, licitacaoAtual: { valor: Number.MAX_SAFE_INTEGER } },
    {
      ...auction,
      produtos: [{ ...auction.produtos[0], produtoId: { nome: 123 } }],
    },
  ])
    assert.equal(isAuction(value), false);
});

test("Destaque ignora entradas inválidas sem perder os leilões válidos", () => {
  const sooner = { ...auction, dataFim: "2026-10-15T12:30:00Z" };
  const invalid = [
    null,
    {},
    { ...auction, produtos: [{ ...auction.produtos[0], produtoId: null }] },
    { ...auction, incremento: 0 },
  ];
  assert.equal(
    upcomingAuctions([...invalid, auction, sooner], now).active[0] ?? null,
    sooner,
  );
  assert.equal(upcomingAuctions(invalid, now).active[0] ?? null, null);
  assert.equal(upcomingAuctions([], now).active[0] ?? null, null);
});

test("Valida todas as linhas de um lote misto e exige pelo menos uma", () => {
  const mixed = {
    ...auction,
    produtos: [
      ...auction.produtos,
      { produtoId: { nome: "Mel" }, quantidade: 2, unidade: "unidade" },
    ],
  };
  assert.equal(isAuction(mixed), true);
  for (const produtos of [
    undefined,
    [],
    [null],
    [...mixed.produtos, { produtoId: null }],
    [{ ...auction.produtos[0], quantidade: 0 }],
    [{ ...auction.produtos[0], unidade: "caixa" }],
  ]) {
    assert.equal(isAuction({ ...auction, produtos }), false);
  }
});

test("Destaque aguarda confirmação do servidor e acompanha o fim localmente", () => {
  const first = {
    ...auction,
    estado: "agendado" as Auction["estado"],
    reservaStock: "pendente" as Auction["reservaStock"],
    dataInicio: new Date(now + 1000).toISOString(),
    dataFim: new Date(now + 3000).toISOString(),
  };
  const second = {
    ...auction,
    _id: "dca000000000000000004002",
    estado: "agendado" as Auction["estado"],
    reservaStock: "pendente" as Auction["reservaStock"],
    dataInicio: new Date(now + 2000).toISOString(),
    dataFim: new Date(now + 4000).toISOString(),
  };
  const list = [null, first, second, { ...first, estado: "terminado" }];
  assert.equal(upcomingAuctions(list, now).active[0] ?? null, null);
  assert.equal(upcomingAuctions(list, now + 999).active[0] ?? null, null);
  assert.equal(upcomingAuctions(list, now + 1000).active[0] ?? null, null);
  first.estado = "ativo";
  first.reservaStock = "reservada";
  assert.equal(upcomingAuctions(list, now + 2000).active[0] ?? null, first);
  second.estado = "ativo";
  second.reservaStock = "reservada";
  assert.equal(upcomingAuctions(list, now + 3000).active[0] ?? null, second);
  assert.equal(upcomingAuctions(list, now + 4000).active[0] ?? null, null);
  assert.equal(first.estado, "ativo");
});

test("Cancelados mantêm estado e motivo e nunca entram no destaque", () => {
  const cancelled: Auction = {
    ...auction,
    estado: "cancelado",
    reservaStock: "sem-reserva",
    motivoCancelamento: "stock-insuficiente",
  };
  assert.equal(isAuction(cancelled), true);
  assert.equal(auctionState(cancelled, now), "cancelado");
  assert.equal(
    auctionState(cancelled, Date.parse(auction.dataFim) + 1000),
    "cancelado",
  );
  assert.equal(upcomingAuctions([cancelled], now).active[0] ?? null, null);
  assert.equal(isAuction({ ...cancelled, motivoCancelamento: "outro" }), false);
  assert.equal(
    auctionState({ ...auction, reservaStock: "pendente" }, now),
    "agendado",
  );
});
