import type { Order } from "./order";

export const salesPeriods = {
  month: "Mês",
  halfYear: "6 meses",
  year: "Ano",
} as const;
export type SalesPeriod = keyof typeof salesPeriods;

const lisbonDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const monthName = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "UTC",
  month: "long",
});

const shortMonth = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "UTC",
  month: "short",
});

function dateParts(date: Date) {
  const parts = lisbonDate.formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function producerSales(
  orders: Order[],
  producerId: string,
  now: Date,
  period: SalesPeriod = "halfYear",
) {
  const ownOrders = orders.filter(
    (order) => order.produtorId?._id === producerId,
  );
  const { year, month, day } = dateParts(now);
  const currentMonth = year * 12 + month - 1;
  const previous = new Date(Date.UTC(year, month - 2, 1));
  const daily = period === "month";
  const bucketCount = daily ? day : period === "year" ? month : 6;
  const firstMonth = daily ? currentMonth : currentMonth - bucketCount + 1;
  const series = Array.from({ length: bucketCount }, (_, index) => ({
    label: daily
      ? String(index + 1)
      : shortMonth.format(
          new Date(Date.UTC(year, month - bucketCount + index, 1)),
        ),
    total: 0,
  }));
  const products = new Map<string, { name: string; total: number }>();
  let hasMixedLots = false;
  let currentTotal = 0;
  let previousTotal = 0;
  for (const order of ownOrders) {
    if (order.estado !== "entregue" || !order.dataEntrega) continue;
    const deliveredAt = new Date(order.dataEntrega);
    if (!Number.isFinite(deliveredAt.getTime()) || deliveredAt > now) continue;
    const delivery = dateParts(deliveredAt);
    const deliveryMonth = delivery.year * 12 + delivery.month - 1;
    if (deliveryMonth === currentMonth) currentTotal += order.total;
    if (deliveryMonth === currentMonth - 1) previousTotal += order.total;
    if (deliveryMonth < firstMonth) continue;
    const index = daily ? delivery.day - 1 : deliveryMonth - firstMonth;
    series[index].total += order.total;
    if (order.leilaoId && order.linhas.length > 1) {
      hasMixedLots = true;
      continue;
    }
    for (const line of order.linhas) {
      const total = order.leilaoId
        ? order.total
        : Math.round((line.precoUnitario ?? 0) * line.quantidade);
      if (total <= 0) continue;
      const product = products.get(line.produtoId);
      if (product) product.total += total;
      else products.set(line.produtoId, { name: line.nome, total });
    }
  }
  return {
    currentTotal,
    series,
    hasMixedLots,
    ranking: [...products]
      .map(([id, product]) => ({ id, ...product }))
      .sort(
        (a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-PT"),
      )
      .slice(0, 3),
    previousMonth: monthName.format(previous),
    change:
      previousTotal === 0
        ? null
        : Math.round(((currentTotal - previousTotal) / previousTotal) * 100),
    recent: ownOrders
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 5),
  };
}
