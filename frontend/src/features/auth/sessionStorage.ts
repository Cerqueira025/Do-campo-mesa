import type { Session } from "./auth.ts";

const storageKey = "campo-mesa:sessao";

export function storedToken(): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null");
    return typeof value?.token === "string" && value.token ? value.token : null;
  } catch {
    return null;
  }
}

export function storeSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
    else localStorage.removeItem(storageKey);
  } catch {
    /* A sessão em memória continua disponível se o armazenamento estiver bloqueado. */
  }
}

// O prazo serve apenas para terminar a sessão na interface; a API valida a assinatura.
export function tokenExpiresAt(token: string): number {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : 0;
  } catch {
    return 0;
  }
}
