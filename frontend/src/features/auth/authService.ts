import { api } from "../../api/client.ts";
import type { AuthUser, Registration, Session } from "./auth.ts";

export const login = (email: string, password: string) =>
  api<Session>("/auth/login", { method: "POST", body: { email, password } });
export const register = (body: Registration) =>
  api<AuthUser>("/auth/registo", { method: "POST", body });
export const currentUser = (token: string, signal?: AbortSignal) =>
  api<AuthUser>("/auth/eu", { token, signal });
export const resetPassword = (email: string, password: string) =>
  api<{ mensagem: string }>("/auth/recuperar-password", {
    method: "POST",
    body: { email, password },
  });
