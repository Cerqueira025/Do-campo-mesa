export type Role = "comprador" | "produtor" | "administrador";
export type Approval = "pendente" | "aceite" | "rejeitado";
export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  papel: Role;
  validacao?: Approval;
}
export interface Session {
  token: string;
  utilizador: AuthUser;
}
export interface Registration {
  nome: string;
  email: string;
  password: string;
  papel: "comprador" | "produtor";
  perfilProdutor?: {
    descricao: string;
    localidade: string;
    morada: string;
    coordenadas: { latitude: number; longitude: number };
  };
}

export function safeReturnPath(value: string | null): string | null {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return null;
  try {
    const url = new URL(value, "https://campo-mesa.local");
    if (
      url.origin !== "https://campo-mesa.local" ||
      /^\/(login|registo|recuperar-password)(\/|$)/.test(url.pathname)
    )
      return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export function passwordError(
  password: string,
  confirmation?: string,
): string | null {
  if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
    return "A password deve ter pelo menos 8 caracteres e não ultrapassar 72 bytes em UTF-8.";
  }
  return confirmation !== undefined && password !== confirmation
    ? "As passwords não coincidem."
    : null;
}

export function authHref(
  path: "/login" | "/registo" | "/recuperar-password",
  {
    email = "",
    regresso = null,
  }: { email?: string; regresso?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (email.trim()) params.set("email", email.trim());
  const destination = safeReturnPath(regresso);
  if (destination) params.set("regresso", destination);
  return path + (params.size ? `?${params}` : "");
}
