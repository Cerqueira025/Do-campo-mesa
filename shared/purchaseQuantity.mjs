export const quantityRules = {
  unidade: { initial: 1, min: 1, step: 1 },
  g: { initial: 500, min: 100, step: 100 },
  kg: { initial: 1, min: 0.5, step: 0.5 },
  l: { initial: 1, min: 0.5, step: 0.5 },
};
export function validPurchaseQuantity(value, unit) {
  const rule = quantityRules[unit];
  return Boolean(
    rule &&
    Number.isFinite(value) &&
    value >= rule.min &&
    Number.isSafeInteger(value / rule.step),
  );
}
export function quantityRestriction(unit) {
  const rule = quantityRules[unit];
  if (!rule) return "Unidade de medida não suportada.";
  const step = rule.step.toLocaleString("pt-PT");
  return `Use múltiplos de ${step} ${unit} (mínimo ${step} ${unit}).`;
}
