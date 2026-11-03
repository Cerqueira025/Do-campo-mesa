import { createContext } from "react";
import type { ApiOptions } from "../../api/client";
import type { AuthUser } from "./auth";

export interface AuthState {
  token: string | null;
  utilizador: AuthUser | null;
  estado: "anonimo" | "a-validar" | "autenticado" | "erro";
  erro: string;
}
export interface AuthContextValue extends AuthState {
  entrar: (email: string, password: string) => Promise<AuthUser>;
  sair: () => void;
  atualizar: () => void;
  request: <T>(path: string, options?: Omit<ApiOptions, "token">) => Promise<T>;
}
export const AuthContext = createContext<AuthContextValue | null>(null);
