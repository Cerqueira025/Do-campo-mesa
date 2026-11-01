export const quantityRules: Record<
  string,
  { initial: number; min: number; step: number }
> = {
  unidade: { initial: 1, min: 1, step: 1 },
  g: { initial: 500, min: 100, step: 100 },
  kg: { initial: 1, min: 0.5, step: 0.5 },
  l: { initial: 1, min: 0.5, step: 0.5 },
};

export function maximumPurchaseQuantity(stock: number, unit: string) {
  const rule = quantityRules[unit];
  return rule && stock >= rule.min
    ? Math.floor(stock / rule.step) * rule.step
    : 0;
}

export function initialPurchaseQuantity(unit: string, stock: number) {
  const rule = quantityRules[unit];
  return rule
    ? Math.min(rule.initial, maximumPurchaseQuantity(stock, unit))
    : 0;
}

export function validPurchaseQuantity(
  value: number,
  unit: string,
  stock = Infinity,
) {
  const rule = quantityRules[unit];
  return Boolean(
    rule &&
    Number.isFinite(value) &&
    value >= rule.min &&
    Number.isSafeInteger(value / rule.step) &&
    value <= stock,
  );
}

export function quantityRestriction(unit: string) {
  const rule = quantityRules[unit];
  if (!rule) return "Unidade de medida não suportada.";
  const step = rule.step.toLocaleString("pt-PT");
  return `Use múltiplos de ${step} ${unit} (mínimo ${step} ${unit}).`;
}

export function quantityToAdd(
  unit: string,
  stock: number,
  previous: number,
  requested?: number,
) {
  if (previous !== 0 && !validPurchaseQuantity(previous, unit, stock)) {
    throw new Error("Corrija a quantidade deste produto no carrinho.");
  }
  const quantity = requested ?? initialPurchaseQuantity(unit, stock - previous);
  if (!validPurchaseQuantity(quantity, unit)) {
    throw new Error(
      quantity === 0
        ? "Não existe quantidade suficiente disponível."
        : quantityRestriction(unit),
    );
  }
  if (!validPurchaseQuantity(previous + quantity, unit, stock)) {
    throw new Error("A quantidade excede o stock disponível.");
  }
  return quantity;
}
