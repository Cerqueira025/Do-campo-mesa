import {
  quantityRules,
  quantityRestriction,
  validPurchaseQuantity as validSharedQuantity,
} from "../../../../shared/purchaseQuantity.mjs";
export { quantityRules, quantityRestriction };

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
  return validSharedQuantity(value, unit) && value <= stock;
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
