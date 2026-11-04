export interface ProductFields {
  nome: string;
  descricao: string;
  categoria: string;
  preco: number;
  unidade: "kg" | "g" | "l" | "unidade";
  stock: number;
  epoca: string[];
  biologico: boolean;
  dataValidade?: string | null;
  publicado: boolean;
}
export interface ProducerProduct extends ProductFields {
  _id: string;
  fotografia?: string | null;
  bloqueado: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ProductPage {
  items: ProducerProduct[];
  page: number;
  limit: number;
  total: number;
}
export interface ProductDraft extends Omit<
  ProductFields,
  "preco" | "stock" | "dataValidade"
> {
  preco: string;
  stock: string;
  dataValidade: string;
}
export function productDraft(product?: ProducerProduct): ProductDraft {
  return product
    ? {
        nome: product.nome,
        descricao: product.descricao,
        categoria: product.categoria,
        preco: (product.preco / 100).toFixed(2),
        stock: String(product.stock),
        unidade: product.unidade,
        epoca: [...product.epoca],
        biologico: product.biologico,
        publicado: product.publicado,
        dataValidade: product.dataValidade?.slice(0, 10) ?? "",
      }
    : {
        nome: "",
        descricao: "",
        categoria: "",
        preco: "",
        stock: "",
        unidade: "kg",
        epoca: [],
        biologico: false,
        publicado: false,
        dataValidade: "",
      };
}
export function productPayload(
  draft: ProductDraft,
  original?: ProducerProduct,
): Partial<ProductFields> {
  const price = draft.preco.trim().replace(",", ".");
  const stock = draft.stock.trim().replace(",", ".");
  const [euros, fraction = ""] = price.split(".");
  const cents = Number(euros) * 100 + Number(fraction.padEnd(2, "0"));
  if (
    ![draft.nome, draft.descricao, draft.categoria].every((value) =>
      value.trim(),
    )
  )
    throw new Error("Preencha o nome, a descrição e a categoria.");
  if (!/^\d+(?:\.\d{1,2})?$/.test(price) || !Number.isSafeInteger(cents))
    throw new Error(
      "Indique um preço não negativo com até duas casas decimais.",
    );
  if (!/^\d+(?:\.\d+)?$/.test(stock) || !Number.isFinite(Number(stock)))
    throw new Error("Indique um stock não negativo e finito.");
  if (!["kg", "g", "l", "unidade"].includes(draft.unidade))
    throw new Error("Unidade inválida.");
  const validity = draft.dataValidade
    ? new Date(`${draft.dataValidade}T00:00:00.000Z`)
    : null;
  if (
    validity &&
    (!Number.isFinite(validity.getTime()) ||
      validity.toISOString().slice(0, 10) !== draft.dataValidade)
  )
    throw new Error("Data de validade inválida.");
  const value: ProductFields = {
    ...draft,
    nome: draft.nome.trim(),
    descricao: draft.descricao.trim(),
    categoria: draft.categoria.trim(),
    preco: cents,
    stock: Number(stock),
    dataValidade:
      original &&
      draft.dataValidade === (original.dataValidade?.slice(0, 10) ?? "")
        ? (original.dataValidade ?? null)
        : (validity?.toISOString() ?? null),
  };
  return original
    ? Object.fromEntries(
        Object.entries(value).filter(
          ([key, entry]) =>
            JSON.stringify(entry) !==
            JSON.stringify(
              key === "dataValidade"
                ? (original.dataValidade ?? null)
                : original[key as keyof ProductFields],
            ),
        ),
      )
    : value;
}
export function producerPage(search: string) {
  const value = new URLSearchParams(search).get("page") ?? "1";
  return /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0 &&
    Number.isSafeInteger((Number(value) - 1) * 24)
    ? Number(value)
    : 1;
}
