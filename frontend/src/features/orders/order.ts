export const orderStates = [
  "pendente",
  "confirmada",
  "pronta",
  "entregue",
] as const;
export type OrderState = (typeof orderStates)[number];
export interface Order {
  _id: string;
  compradorId: { _id: string; nome: string } | null;
  produtorId: { _id: string; nome: string } | null;
  estado: OrderState;
  linhas: {
    produtoId: string;
    nome: string;
    precoUnitario?: number;
    quantidade: number;
    unidade: string;
  }[];
  total: number;
  entrega?: {
    tipo: "levantamento" | "entrega";
    morada?: string;
    dataPrevista?: string;
  } | null;
  leilaoId?: string | null;
  createdAt: string;
  dataEntrega?: string;
}
export interface Review {
  _id: string;
  produtoId?: string;
  produtorId?: string;
  classificacao: number;
  comentario: string;
  estado: "publicada" | "oculta" | "denunciada";
}
export const orderDate = (date: string) =>
  new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
