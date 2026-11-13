import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import AuthProvider from "../src/features/auth/AuthProvider";
import { AuthContext } from "../src/features/auth/authContext";
import { useAuth } from "../src/features/auth/useAuth";
import ProtectedRoute from "../src/features/auth/ProtectedRoute";
import LoginPage from "../src/pages/auth/LoginPage";
import RegisterPage from "../src/pages/auth/RegisterPage";
import { storeSession, storedToken } from "../src/features/auth/sessionStorage";
import { navigate } from "../src/navigation/navigation";
import { authValue } from "./fixtures";

vi.mock("../src/components/layout/AppHeader", () => ({ default: () => null }));
vi.mock("../src/navigation/navigation", async (original) => ({
  ...(await original<typeof import("../src/navigation/navigation")>()),
  navigate: vi.fn(),
}));

beforeEach(() => vi.mocked(navigate).mockClear());
afterEach(() => vi.useRealTimers());

test("Pede login preservando o endereço da página protegida", () => {
  window.history.replaceState(null, "", "/encomendas?pagina=2");
  render(
    <AuthContext.Provider
      value={authValue({ estado: "anonimo", utilizador: null, token: null })}
    >
      <ProtectedRoute>
        <p>Conteúdo privado</p>
      </ProtectedRoute>
    </AuthContext.Provider>,
  );
  expect(screen.queryByText("Conteúdo privado")).toBeNull();
  expect(navigate).toHaveBeenCalledWith(
    "/login?regresso=%2Fencomendas%3Fpagina%3D2",
    { replace: true },
  );
});

test("Só apresenta o conteúdo protegido ao papel permitido", () => {
  const view = render(
    <AuthContext.Provider value={authValue()}>
      <ProtectedRoute roles={["administrador"]}>
        <p>Conteúdo privado</p>
      </ProtectedRoute>
    </AuthContext.Provider>,
  );
  expect(screen.getByRole("heading", { name: "Sem permissão" })).toBeTruthy();
  expect(screen.queryByText("Conteúdo privado")).toBeNull();
  const admin = authValue();
  admin.utilizador = { ...admin.utilizador!, papel: "administrador" };
  view.rerender(
    <AuthContext.Provider value={admin}>
      <ProtectedRoute roles={["administrador"]}>
        <p>Conteúdo privado</p>
      </ProtectedRoute>
    </AuthContext.Provider>,
  );
  expect(screen.getByText("Conteúdo privado")).toBeTruthy();
});

test("O login real regressa à página pedida depois de validar as credenciais", async () => {
  window.history.replaceState(
    null,
    "",
    "/login?regresso=%2Fencomendas%3Fpagina%3D2",
  );
  const utilizador = authValue().utilizador!;
  const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
  const fetch = vi
    .fn()
    .mockImplementation(async (url) =>
      Response.json(
        String(url).endsWith("/login") ? { token, utilizador } : utilizador,
      ),
    );
  vi.stubGlobal("fetch", fetch);
  render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );
  expect(screen.queryByRole("link", { name: /esqueceu/i })).toBeNull();
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "maria@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/encomendas?pagina=2", {
      replace: true,
    }),
  );
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    email: "maria@example.test",
    password: "password123",
  });
  expect(storedToken()).toBe(token);
});

test("O seletor de registo alterna os campos de produtor e submete o papel escolhido", async () => {
  window.history.replaceState(null, "", "/registo?papel=produtor");
  const fetch = vi.fn().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetch);
  const auth = authValue({ estado: "anonimo", utilizador: null, token: null });
  render(
    <AuthContext.Provider value={auth}>
      <RegisterPage />
    </AuthContext.Provider>,
  );
  const role = screen.getByRole("combobox", { name: "Tipo de conta" });
  expect(role.textContent).toBe("Produtor");
  expect(screen.getByLabelText("Localidade")).toBeTruthy();
  fireEvent.click(role);
  fireEvent.click(screen.getByRole("option", { name: "Comprador" }));
  expect(screen.queryByLabelText("Localidade")).toBeNull();
  fireEvent.click(role);
  fireEvent.click(screen.getByRole("option", { name: "Produtor" }));
  for (const [label, value] of [
    ["Nome", "Produtor de teste"],
    ["Email", "produtor@example.test"],
    ["Password", "password123"],
    ["Confirmar password", "password123"],
    ["Localidade", "Braga"],
    ["Morada", "Rua da Horta"],
    ["Latitude", "41.55"],
    ["Longitude", "-8.42"],
  ])
    fireEvent.change(screen.getByLabelText(label, { exact: true }), {
      target: { value },
    });
  const form = screen
    .getByRole("button", { name: "Criar conta" })
    .closest("form")!;
  expect(new FormData(form).get("papel")).toBe("produtor");
  fireEvent.submit(form);
  await waitFor(() =>
    expect(auth.entrar).toHaveBeenCalledWith(
      "produtor@example.test",
      "password123",
    ),
  );
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    papel: "produtor",
    perfilProdutor: {
      localidade: "Braga",
      coordenadas: { latitude: 41.55, longitude: -8.42 },
    },
  });
});

test("Termina a sessão e remove o token quando chega a expiração", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  const utilizador = authValue().utilizador!;
  const token = `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 60 }))}.signature`;
  storeSession({ token, utilizador });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(utilizador)));
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(result.current.estado).toBe("autenticado");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(result.current.estado).toBe("anonimo");
  expect(storedToken()).toBeNull();
});

test("Uma resposta 401 invalida a sessão guardada sem revelar conteúdo privado", async () => {
  const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
  storeSession({ token, utilizador: authValue().utilizador! });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ erro: "Sessão expirada" }, { status: 401 }),
      ),
  );
  render(
    <AuthProvider>
      <ProtectedRoute>
        <p>Conteúdo privado</p>
      </ProtectedRoute>
    </AuthProvider>,
  );
  await waitFor(() => expect(storedToken()).toBeNull());
  expect(screen.queryByText("Conteúdo privado")).toBeNull();
  expect(navigate).toHaveBeenCalled();
});

test("A gestão de produtos exige aprovação atual do produtor", () => {
  const auth = authValue();
  const page = (validacao: "pendente" | "rejeitado" | "aceite") => (
    <AuthContext.Provider
      value={{
        ...auth,
        utilizador: { ...auth.utilizador!, papel: "produtor", validacao },
      }}
    >
      <ProtectedRoute roles={["produtor"]} approvedProducer>
        <p>Gestão de produtos</p>
      </ProtectedRoute>
    </AuthContext.Provider>
  );
  const view = render(page("pendente"));
  expect(screen.queryByText("Gestão de produtos")).toBeNull();
  view.rerender(page("rejeitado"));
  expect(screen.queryByText("Gestão de produtos")).toBeNull();
  view.rerender(page("aceite"));
  expect(screen.getByText("Gestão de produtos")).toBeTruthy();
});
