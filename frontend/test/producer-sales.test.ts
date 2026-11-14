import assert from "node:assert/strict";
import test from "node:test";
import type { Order } from "../src/features/orders/order.ts";
import { producerSales } from "../src/features/orders/producerSales.ts";

function order(id: number, overrides: Partial<Order> = {}): Order {
  return {
    _id: String(id),
    produtorId: { _id: "produtor", nome: "Produtor" },
    compradorId: null,
    linhas: [],
    estado: "entregue",
    total: 1000,
    createdAt: new Date(Date.UTC(2025, 11, id)).toISOString(),
    ...overrides,
  };
}

test("Conta encomendas próprias pela data de entrega em Lisboa, incluindo leilões", () => {
  const sales = producerSales(
    [
      order(1, { dataEntrega: "2026-07-31T23:00:00Z", leilaoId: "leilao" }),
      order(2, { dataEntrega: "2026-07-31T22:59:59Z", total: 800 }),
      order(3, { estado: "pendente", dataEntrega: "2026-08-01T00:00:00Z" }),
      order(4, { estado: "confirmada" }),
      order(5, { estado: "pronta" }),
      order(6),
      order(7, { dataEntrega: "inválida" }),
      order(8, {
        produtorId: { _id: "outro", nome: "Outro" },
        dataEntrega: "2026-08-01T00:00:00Z",
      }),
    ],
    "produtor",
    new Date("2026-08-01T12:00:00Z"),
  );
  assert.equal(sales.currentTotal, 1000);
  assert.equal(sales.change, 25);
  assert.equal(sales.previousMonth, "julho");
  assert.deepEqual(
    sales.recent.map(({ _id }) => _id),
    ["7", "6", "5", "4", "3"],
  );
});

test("Compara janeiro com dezembro e trata o mês anterior sem vendas", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const lastYear = order(1, { dataEntrega: "2025-12-31T23:59:59Z" });
  const newYear = order(2, { dataEntrega: "2026-01-01T00:00:00Z", total: 666 });
  const sales = producerSales([lastYear, newYear], "produtor", now);
  assert.equal(sales.currentTotal, 666);
  assert.equal(sales.change, -33);
  assert.equal(sales.previousMonth, "dezembro");
  assert.equal(producerSales([lastYear], "produtor", now).change, -100);
  assert.equal(producerSales([newYear], "produtor", now).change, null);
});

test("Os períodos partilham as entregas, mas o ranking exclui lotes mistos", () => {
  const line = {
    produtoId: "maca",
    nome: "Maçã",
    unidade: "kg",
    quantidade: 1.5,
    precoUnitario: 333,
  };
  const orders = [
    order(1, {
      dataEntrega: "2026-01-01T10:00:00Z",
      linhas: [line],
      total: 500,
    }),
    order(2, {
      dataEntrega: "2026-03-01T10:00:00Z",
      linhas: [line],
      total: 700,
      leilaoId: "simples",
    }),
    order(3, {
      dataEntrega: "2026-03-02T10:00:00Z",
      linhas: [line, { ...line, produtoId: "pera" }],
      total: 1000,
      leilaoId: "misto",
    }),
  ];
  const now = new Date("2026-03-03T12:00:00Z");
  const daily = producerSales(orders, "produtor", now, "month");
  assert.deepEqual(
    daily.series.map(({ total }) => total),
    [700, 1000, 0],
  );
  assert.equal(daily.ranking[0].total, 700);
  assert.equal(daily.hasMixedLots, true);
  const yearly = producerSales(orders, "produtor", now, "year");
  assert.deepEqual(
    yearly.series.map(({ total }) => total),
    [500, 0, 1700],
  );
  assert.deepEqual(yearly.ranking, [{ id: "maca", name: "Maçã", total: 1200 }]);
  const halfYear = producerSales(orders, "produtor", now);
  assert.deepEqual(
    halfYear.series.map(({ total }) => total),
    [0, 0, 0, 500, 0, 1700],
  );
});
