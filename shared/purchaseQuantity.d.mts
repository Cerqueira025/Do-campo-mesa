export const quantityRules: Record<
  string,
  { initial: number; min: number; step: number }
>;
export function validPurchaseQuantity(value: number, unit: string): boolean;
export function quantityRestriction(unit: string): string;
