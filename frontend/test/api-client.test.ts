import test from "node:test";
import assert from "node:assert/strict";
import { api, ApiError } from "../src/api/client.ts";

test("Cliente envia PUT e DELETE com corpo opcional e devolve respostas 204", async (t) => {
  const requests: { url: string; options?: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(null, { status: 204 });
  });
  const putResult = await api<void>("/products/1", {
    method: "PUT",
    token: "token",
    body: { stock: 5 },
  });
  const deleteResult = await api<void>("/products/1", {
    method: "DELETE",
    token: "token",
  });
  assert.equal(putResult, undefined);
  assert.equal(deleteResult, undefined);
  assert.deepEqual(
    requests.map(({ options }) => options?.method),
    ["PUT", "DELETE"],
  );
  assert.deepEqual(JSON.parse(String(requests[0].options?.body)), { stock: 5 });
  assert.equal(requests[1].options?.body, undefined);
  assert.deepEqual(requests[1].options?.headers, {
    Accept: "application/json",
    Authorization: "Bearer token",
  });
});

test("Cliente preserva respostas JSON e erros HTTP", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) =>
    options?.method === "PUT"
      ? Response.json({ updated: true })
      : Response.json({ erro: "Sem permissão." }, { status: 403 }),
  );
  assert.deepEqual(
    await api<{ updated: boolean }>("/resource", { method: "PUT" }),
    {
      updated: true,
    },
  );
  await assert.rejects(
    api("/resource", { method: "DELETE" }),
    (error: ApiError) =>
      error.status === 403 && error.message === "Sem permissão.",
  );
});

test("Cliente envia Blob binário com MIME e autorização sem serializar JSON", async (t) => {
  const file = new Blob(["imagem"], { type: "image/png" });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), "/api/products/1/photo");
    assert.equal(options?.body, file);
    assert.deepEqual(options?.headers, {
      Accept: "application/json",
      "Content-Type": "image/png",
      Authorization: "Bearer token",
    });
    return Response.json({ fotografia: "id" });
  });
  assert.deepEqual(
    await api("/products/1/photo", {
      method: "PUT",
      token: "token",
      body: file,
    }),
    { fotografia: "id" },
  );
});
