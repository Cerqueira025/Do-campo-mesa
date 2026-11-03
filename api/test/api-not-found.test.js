import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";

test("Rotas API inexistentes devolvem JSON 404 sem alterar rotas existentes", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const missing = await fetch(`${base}/api/rota-inexistente`);
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await missing.json(), {
    erro: "Rota da API não encontrada.",
  });

  const existing = await fetch(`${base}/api/health`);
  assert.equal(existing.status, 200);
  assert.deepEqual(await existing.json(), { status: "ok" });

  const outsideApi = await fetch(`${base}/rota-inexistente`);
  assert.equal(outsideApi.status, 404);
  assert.match(outsideApi.headers.get("content-type"), /text\/html/);
});
