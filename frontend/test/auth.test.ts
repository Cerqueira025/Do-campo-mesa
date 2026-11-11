import test from "node:test";
import assert from "node:assert/strict";
import { api, ApiError } from "../src/api/client.ts";
import {
  storedToken,
  storeSession,
  tokenExpiresAt,
} from "../src/features/auth/sessionStorage.ts";
import {
  safeReturnPath,
  passwordError,
  authHref,
  type Session,
} from "../src/features/auth/auth.ts";
import {
  login,
  register,
  currentUser,
} from "../src/features/auth/authService.ts";

test("Cliente envia JWT e JSON e distingue 401, 403 e falhas de rede", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/producers/id/validacao");
    assert.equal(options?.method, "PATCH");
    assert.deepEqual(options?.headers, {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer teste",
    });
    assert.deepEqual(JSON.parse(options?.body as string), {
      validacao: "aceite",
    });
    return Response.json({ validacao: "aceite" });
  });
  assert.deepEqual(
    await api("/producers/id/validacao", {
      method: "PATCH",
      token: "teste",
      body: { validacao: "aceite" },
    }),
    { validacao: "aceite" },
  );
  for (const status of [401, 403]) {
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ erro: "Sem acesso" }, { status }),
    );
    await assert.rejects(
      api("/auth/eu"),
      (error: ApiError) =>
        error.status === status && error.message === "Sem acesso",
    );
  }
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    api("/auth/eu"),
    (error: ApiError) => error.status === 0,
  );
});

test("Cliente trata respostas sem JSON e mantém cancelamento de pedidos", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("<html>erro</html>", { status: 502 }),
  );
  await assert.rejects(
    api("/auth/eu"),
    (error: ApiError) => error.status === 502,
  );
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, "fetch", async () => {
    throw controller.signal.reason;
  });
  await assert.rejects(
    api("/auth/eu", { signal: controller.signal }),
    (error) => error === controller.signal.reason,
  );
});

test("Serviço preserva os contratos de registo, login e consulta de sessão", async (t) => {
  const requests: { path: string; options?: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (path, options) => {
    requests.push({ path: String(path), options });
    return Response.json({});
  });
  await register({
    nome: "Maria",
    email: "maria@example.test",
    password: "password123",
    papel: "comprador",
  });
  await login("maria@example.test", "password123");
  await currentUser("token-teste");
  assert.deepEqual(
    requests.map((item) => item.path),
    ["/api/auth/registo", "/api/auth/login", "/api/auth/eu"],
  );
  assert.equal(
    (requests[0].options?.headers as Record<string, string>).Authorization,
    undefined,
  );
  assert.equal(
    (requests[2].options?.headers as Record<string, string>).Authorization,
    "Bearer token-teste",
  );
});

test("Persistência recupera apenas o token, limpa logout e tolera armazenamento inválido ou bloqueado", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  const session: Session = {
    token: "token-teste",
    utilizador: {
      id: "id",
      nome: "Maria",
      email: "maria@example.test",
      papel: "comprador",
    },
  };
  storeSession(session);
  assert.equal(storedToken(), "token-teste");
  storeSession(null);
  assert.equal(storedToken(), null);
  values.set("campo-mesa:sessao", "json-invalido");
  assert.equal(storedToken(), null);
  values.set("campo-mesa:sessao", JSON.stringify({ token: 42 }));
  assert.equal(storedToken(), null);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Armazenamento bloqueado");
    },
  });
  assert.equal(storedToken(), null);
  assert.doesNotThrow(() => storeSession(session));
});

test("Regresso aceita só destinos internos e não cria ciclos de login", () => {
  assert.equal(
    safeReturnPath("/conta?origem=login#estado"),
    "/conta?origem=login#estado",
  );
  for (const path of [
    null,
    "https://external.test",
    "//external.test",
    "/\\external.test",
    "/login",
    "/registo?papel=produtor",
    "/admin/../../login",
    "javascript:alert(1)",
  ])
    assert.equal(safeReturnPath(path), null);
});

test("Expiração é lida para a interface e o limite da password respeita bytes UTF-8", () => {
  const token = `header.${btoa(JSON.stringify({ exp: 1790000000 }))}.signature`;
  assert.equal(tokenExpiresAt(token), 1790000000000);
  assert.equal(tokenExpiresAt("invalido"), 0);
  assert.equal(tokenExpiresAt(`a.${btoa("{}")}.c`), 0);
  assert.ok(passwordError("curta"));
  assert.equal(passwordError("a".repeat(72)), null);
  assert.equal(passwordError("á".repeat(36)), null);
  assert.ok(passwordError("á".repeat(37)));
});

test("Confirmação de password e ligações entre formulários preservam o regresso seguro", () => {
  assert.equal(passwordError("PasswordNova123!", "PasswordNova123!"), null);
  assert.equal(
    passwordError("PasswordNova123!", "outra-password"),
    "As passwords não coincidem.",
  );
  assert.equal(passwordError("curta", "curta")?.includes("8 caracteres"), true);
  const url = new URL(
    authHref("/registo", {
      email: " maria@example.test ",
      regresso: "/admin/produtores",
    }),
    "https://campo-mesa.local",
  );
  assert.equal(url.pathname, "/registo");
  assert.equal(url.searchParams.get("email"), "maria@example.test");
  assert.equal(url.searchParams.get("regresso"), "/admin/produtores");
  assert.equal(authHref("/login", { regresso: "//external.test" }), "/login");
  assert.equal(authHref("/registo", { regresso: "/login" }), "/registo");
  assert.equal(safeReturnPath("/login?email=teste"), null);
});
