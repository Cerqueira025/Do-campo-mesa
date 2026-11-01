import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, type ApiOptions } from "../../api/client";
import { AuthContext, type AuthState } from "./authContext";
import { currentUser, login } from "./authService";
import { storedToken, storeSession, tokenExpiresAt } from "./sessionStorage";

const anonymous: AuthState = {
  token: null,
  utilizador: null,
  estado: "anonimo",
  erro: "",
};

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = storedToken();
    return token ? { ...anonymous, token, estado: "a-validar" } : anonymous;
  });
  const [revision, setRevision] = useState(0);
  const activeToken = useRef(state.token);
  const token = state.token;

  const clearSession = useCallback((expected?: string) => {
    if (expected && activeToken.current !== expected) return;
    activeToken.current = null;
    storeSession(null);
    setState(anonymous);
  }, []);
  const sair = useCallback(() => clearSession(), [clearSession]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    async function validate() {
      try {
        const utilizador = await currentUser(token!, controller.signal);
        if (controller.signal.aborted || activeToken.current !== token) return;
        storeSession({ token: token!, utilizador });
        setState({ token, utilizador, estado: "autenticado", erro: "" });
      } catch (error) {
        if (controller.signal.aborted || activeToken.current !== token) return;
        if (error instanceof ApiError && error.status === 401)
          clearSession(token!);
        else
          setState({
            token,
            utilizador: null,
            estado: "erro",
            erro: "Não foi possível validar a sessão. Tente novamente.",
          });
      }
    }
    void validate();
    return () => controller.abort();
  }, [token, revision, clearSession]);

  useEffect(() => {
    if (!token) return;
    const remaining = tokenExpiresAt(token) - Date.now();
    const timer = window.setTimeout(
      () => clearSession(token),
      Math.max(0, Math.min(remaining, 2_147_483_647)),
    );
    return () => window.clearTimeout(timer);
  }, [token, clearSession]);

  const entrar = useCallback(async (email: string, password: string) => {
    const session = await login(email, password);
    activeToken.current = session.token;
    storeSession(session);
    setState({ ...session, estado: "autenticado", erro: "" });
    return session.utilizador;
  }, []);

  const atualizar = useCallback(() => {
    setState((previous) =>
      previous.token
        ? { ...previous, estado: "a-validar", erro: "" }
        : previous,
    );
    setRevision((value) => value + 1);
  }, []);

  const request = useCallback(
    async <T,>(path: string, options: Omit<ApiOptions, "token"> = {}) => {
      try {
        return await api<T>(path, { ...options, token: token ?? undefined });
      } catch (error) {
        if (token && error instanceof ApiError && error.status === 401)
          clearSession(token);
        throw error;
      }
    },
    [token, clearSession],
  );

  return (
    <AuthContext.Provider
      value={{ ...state, entrar, sair, atualizar, request }}
    >
      {children}
    </AuthContext.Provider>
  );
}
