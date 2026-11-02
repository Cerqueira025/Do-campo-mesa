export const adminSections = {
  produtores: { title: "Produtores pendentes", resource: "users" },
  avaliacoes: { title: "Avaliações", resource: "reviews" },
  produtos: { title: "Produtos", resource: "products" },
  utilizadores: { title: "Utilizadores", resource: "users" },
  encomendas: { title: "Encomendas", resource: "orders" },
  leiloes: { title: "Leilões", resource: "auctions" },
} as const;
export type AdminSection = keyof typeof adminSections;

export interface AdminReference {
  _id: string;
  nome: string;
  perfilProdutor?: { localidade?: string; validacao?: string };
}
export interface AdminDecision {
  administradorId: AdminReference | null;
  data: string;
  motivo: string;
}
export interface AdminRecord {
  _id: string;
  nome?: string;
  email?: string;
  papel?: string;
  createdAt: string;
  updatedAt?: string;
  totalDenuncias?: number;
  denuncias?: {
    autorId: AdminReference | null;
    motivo: string;
    data: string;
  }[];
  perfilProdutor?: {
    descricao: string;
    localidade: string;
    morada: string;
    validacao: string;
    coordenadas: { latitude: number; longitude: number };
  };
  ultimaDecisao?: AdminDecision;
  produtorId?: AdminReference | null;
  compradorId?: AdminReference | null;
  autorId?: AdminReference | null;
  produtoId?: AdminReference | null;
  encomendaId?: string;
  classificacao?: number;
  comentario?: string;
  estado?: string;
  descricao?: string;
  categoria?: string;
  preco?: number;
  unidade?: string;
  stock?: number;
  publicado?: boolean;
  bloqueado?: boolean;
  visivel?: boolean;
  epoca?: string[];
  biologico?: boolean;
  dataValidade?: string;
  total?: number;
  leilaoId?: string;
  lote?: string;
  dataInicio?: string;
  dataFim?: string;
  precoBase?: number;
  incremento?: number;
  reservaStock?: string;
  motivoCancelamento?: string;
  licitacaoAtual?: { valor: number; compradorId: AdminReference | null };
  produtos?: {
    produtoId: AdminReference | null;
    quantidade: number;
    unidade: string;
  }[];
  leiloes?: { _id: string; lote: string; estado: string; dataFim: string }[];
  licitacoes?: {
    _id: string;
    valor: number;
    compradorId: AdminReference | null;
    createdAt: string;
  }[];
}
export interface AdminListResponse {
  items: AdminRecord[];
  page: number;
  limit: number;
  total: number;
  categorias?: string[];
}
export interface AdminSummary {
  users: Record<string, number>;
  orders: Record<string, number>;
  pendingProducers: number;
  activeAuctions: number;
}

export function readAdminLocation(section: AdminSection, search: string) {
  const params = new URLSearchParams(search);
  if (section === "produtores") {
    params.set("papel", "produtor");
    params.set("validacao", "pendente");
  }
  if (section === "leiloes" && !params.has("estado"))
    params.set("estado", "ativo");
  const raw = params.get("page") ?? "1";
  const page =
    /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0
      ? Number(raw)
      : 1;
  params.set("page", String(page));
  params.set("limit", "24");
  if (params.has("q")) params.set("q", (params.get("q") ?? "").slice(0, 100));
  return params;
}

export function adminDetailHref(
  section: AdminSection,
  id: string,
  listUrl: string,
) {
  return `/admin/${section}/${id}?regresso=${encodeURIComponent(listUrl)}`;
}

export function adminReturnUrl(section: AdminSection, search: string) {
  const value = new URLSearchParams(search).get("regresso");
  const base = `/admin/${section}`;
  return value === base || value?.startsWith(`${base}?`) ? value : base;
}

export const referenceName = (value?: AdminReference | null) =>
  value?.nome || "Indisponível";
export const adminDate = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("pt-PT", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
export const adminMoney = (value?: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    (value ?? 0) / 100,
  );
