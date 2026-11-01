import type { ApiProduct } from "../products/product";
import type { CatalogFilters, FilterOptions } from "./catalogFilters";

export interface CatalogResponse {
  items: ApiProduct[];
  total: number;
}
const queries = new Map<string, CatalogResponse>();
let options: FilterOptions | null = null;

export const catalogPageSize = 24;

export function catalogQuery(
  search: string,
  filters: CatalogFilters,
  page = 1,
) {
  const params = new URLSearchParams({ limit: "24" });
  // Mantém o offset dentro dos inteiros seguros aceites pela API, mesmo com URLs extremas.
  params.set(
    "page",
    String(
      Math.min(page, Math.floor(Number.MAX_SAFE_INTEGER / catalogPageSize)),
    ),
  );
  if (search.trim()) params.set("q", search.trim());
  for (const key of Object.keys(filters).sort() as (keyof CatalogFilters)[]) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return params.toString();
}

export function readCatalogCache(key: string) {
  const value = queries.get(key);
  if (value) {
    queries.delete(key);
    queries.set(key, value);
  }
  return value;
}

export function writeCatalogCache(key: string, value: CatalogResponse) {
  queries.delete(key);
  queries.set(key, value);
  if (queries.size > 10) queries.delete(queries.keys().next().value!);
}

export const readFilterCache = () => options;
export function writeFilterCache(value: FilterOptions) {
  options = value;
}

let filtersOpen = false;
export const readFiltersOpen = () => filtersOpen;
export function writeFiltersOpen(value: boolean) {
  filtersOpen = value;
}
