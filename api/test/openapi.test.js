import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import SwaggerParser from "@apidevtools/swagger-parser";
import Ajv from "ajv-draft-04";
import YAML from "yaml";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import auth from "../src/routes/auth.js";
import products from "../src/routes/products.js";
import producers from "../src/routes/producers.js";
import orders from "../src/routes/orders.js";
import reviews from "../src/routes/reviews.js";
import auctions from "../src/routes/auctions.js";
import backoffice from "../src/routes/backoffice.js";
import admin from "../src/routes/admin.js";
import User from "../src/models/User.js";

const source = readFileSync(
  new URL("../../docs/openapi.yaml", import.meta.url),
  "utf8",
);
const specification = YAML.parse(source);
const methods = ["get", "post", "put", "patch", "delete"];
const operations = Object.entries(specification.paths).flatMap(([path, item]) =>
  methods
    .filter((method) => item[method])
    .map((method) => ({ path, method, operation: item[method] })),
);
const secret = "openapi-tests-jwt-secret-at-least-32-characters";
const id = "dca000000000000000000001";
const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true });
let server, base, resolved;

before(async () => {
  process.env.JWT_SECRET = secret;
  resolved = await SwaggerParser.validate(structuredClone(specification));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
});

function validateResponse(path, method, status, body) {
  const schema =
    resolved.paths[path][method].responses[status].content["application/json"]
      .schema;
  const validator = ajv.compile(schema);
  assert.ok(validator(body), JSON.stringify(validator.errors));
}

test("OpenAPI 3.0.3 valida os schemas sem referências externas", () => {
  assert.equal(resolved.openapi, "3.0.3");
  for (const schema of Object.values(resolved.components.schemas))
    ajv.compile(schema);
  assert.doesNotMatch(source, /\$ref:\s*["']?https?:/);
});

test("Todas as rotas REST implementadas correspondem às operações documentadas", () => {
  const implemented = new Set(["get /health"]);
  for (const [prefix, router] of [
    ["/auth", auth],
    ["/products", products],
    ["/producers", producers],
    ["/orders", orders],
    ["/reviews", reviews],
    ["/auctions", auctions],
    ["", backoffice],
    ["/admin", admin],
  ]) {
    for (const { route } of router.stack) {
      if (!route) continue;
      const path = `${prefix}${route.path === "/" ? "" : route.path}`.replace(
        /:id\b/g,
        "{id}",
      );
      const paths = path.includes(":resource")
        ? ["users", "products", "reviews", "orders", "auctions"]
            .filter(
              (resource) => resource !== "orders" || !path.endsWith("/{id}"),
            )
            .map((resource) => path.replace(":resource", resource))
        : [path];
      for (const method of methods.filter((method) => route.methods[method]))
        for (const concretePath of paths)
          implemented.add(`${method} ${concretePath}`);
    }
  }
  assert.deepEqual(
    operations.map(({ path, method }) => `${method} ${path}`).sort(),
    [...implemented].sort(),
  );
});

test("Swagger publica o YAML original e os recursos no mesmo endereço", async () => {
  const redirect = await fetch(`${base}/api-docs`, { redirect: "manual" });
  assert.equal(redirect.status, 301);
  assert.match(redirect.headers.get("location"), /\/api-docs\/$/);
  const page = await fetch(`${base}/api-docs/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /swagger-ui/);
  const spec = await fetch(`${base}/api-docs/openapi.yaml`);
  assert.equal(spec.status, 200);
  assert.match(spec.headers.get("content-type"), /application\/yaml/);
  assert.equal(await spec.text(), source);
  assert.deepEqual(specification.servers, [{ url: "/api" }]);
  for (const asset of [
    "swagger-ui.css",
    "swagger-ui-bundle.js",
    "swagger-ui-standalone-preset.js",
    "swagger-ui-init.js",
  ]) {
    const result = await fetch(`${base}/api-docs/${asset}`);
    assert.equal(result.status, 200, asset);
    if (asset === "swagger-ui-init.js") {
      const script = await result.text();
      assert.match(script, /"url":\s*"\/api-docs\/openapi.yaml"/);
      assert.match(script, /"persistAuthorization":\s*false/);
      assert.match(script, /"validatorUrl":\s*null/);
    }
  }
});

test("As operações protegidas documentadas recusam pedidos sem credenciais", async () => {
  for (const { path, method, operation } of operations) {
    if (!operation.security?.length) continue;
    const result = await fetch(`${base}/api${path.replace("{id}", id)}`, {
      method: method.toUpperCase(),
    });
    assert.equal(result.status, 401, `${method} ${path}`);
    validateResponse(path, method, 401, await result.json());
  }
});

test("Health e erros de filtros respeitam o contrato", async () => {
  for (const [path, actualPath, status] of [
    ["/health", "/health", 200],
    ["/products", "/products?precoMax=invalido", 400],
    ["/auctions", "/auctions?estado=invalido", 400],
  ]) {
    const result = await fetch(`${base}/api${actualPath}`);
    assert.equal(result.status, status);
    validateResponse(path, "get", status, await result.json());
  }
});

test("Login e sessão conservam os dados públicos existentes sem expor o hash", async (t) => {
  const user = new User({
    _id: id,
    nome: "Administrador",
    email: "admin@example.test",
    papel: "administrador",
    passwordHash: await bcrypt.hash("CampoMesaDemo123!", 4),
  });
  t.mock.method(User, "findOne", () => ({ select: async () => user }));
  t.mock.method(User, "findById", () => ({ select: async () => user }));
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: "CampoMesaDemo123!" }),
  });
  assert.equal(login.status, 200);
  const session = await login.json();
  validateResponse("/auth/login", "post", 200, session);
  assert.deepEqual(session.utilizador, {
    id,
    nome: user.nome,
    email: user.email,
    papel: user.papel,
  });
  assert.equal(JSON.stringify(session).includes("passwordHash"), false);
  const current = await fetch(`${base}/api/auth/eu`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  assert.equal(current.status, 200);
  assert.equal(current.headers.get("cache-control"), "no-store");
  const body = await current.json();
  validateResponse("/auth/eu", "get", 200, body);
  assert.deepEqual(body, session.utilizador);
  user.papel = "comprador";
  const forbidden = await fetch(`${base}/api/admin/services`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  assert.equal(forbidden.status, 403);
});

test("Sessão recusa tokens inválidos e contas removidas", async (t) => {
  t.mock.method(User, "findById", () => ({ select: async () => null }));
  for (const token of [
    "invalid",
    jwt.sign({ id }, secret, { expiresIn: "1h" }),
    jwt.sign({ id }, secret),
  ]) {
    const result = await fetch(`${base}/api/auth/eu`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(result.status, 401);
  }
});
