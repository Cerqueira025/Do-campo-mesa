import test from "node:test";
import assert from "node:assert/strict";
import { seedData } from "../src/scripts/seed-data.js";
import Auction from "../src/models/Auction.js";
import { migrateAuctionStock } from "../src/scripts/auction-stock-migration.js";

const now = Date.parse("2026-10-18T12:00:00Z");
function legacy() {
  const document = seedData("$2b$04$" + "a".repeat(53), new Date(now)).find(
    ([model]) => model === Auction,
  )[1][0];
  delete document.reservaStock;
  return document;
}
function collection(documents) {
  let writes = 0;
  return {
    find() {
      return { toArray: async () => documents };
    },
    async bulkWrite(operations) {
      writes++;
      for (const { updateOne } of operations)
        Object.assign(
          documents.find((d) => String(d._id) === String(updateOne.filter._id)),
          updateOne.update.$set,
        );
      return { modifiedCount: operations.length };
    },
    get writes() {
      return writes;
    },
  };
}

test("Migração preserva históricos, reprograma ativos sem descontar stock e pode repetir-se", async () => {
  const future = legacy();
  const ended = {
    ...legacy(),
    _id: "000000000000000000000002",
    dataFim: new Date(now - 1),
    dataInicio: new Date(now - 1000),
    licitacaoAtual: { valor: 2000, compradorId: "000000000000000000000003" },
  };
  const active = {
    ...legacy(),
    _id: "000000000000000000000004",
    estado: "ativo",
    dataInicio: new Date(now - 1000),
  };
  const originals = [future, ended, active].map((d) => ({ ...d }));
  const db = collection([future, ended, active]);
  assert.equal(await migrateAuctionStock(db, now), 3);
  for (const [index, document] of [future, ended, active].entries()) {
    const expected =
      index === 1
        ? { estado: "terminado", reservaStock: "sem-reserva" }
        : { estado: "agendado", reservaStock: "pendente" };
    assert.deepEqual(document, { ...originals[index], ...expected });
  }
  assert.equal(await migrateAuctionStock(db, now), 0);
  assert.equal(db.writes, 1);
});

test("Dados inválidos ou formato antigo impedem todas as escritas", async () => {
  for (const changes of [
    { produtos: [] },
    { produtoId: "000000000000000000000003" },
    { reservaStock: "desconhecida" },
    { estado: "desconhecido" },
  ]) {
    const valid = legacy();
    const invalid = {
      ...legacy(),
      _id: "000000000000000000000009",
      ...changes,
    };
    const db = collection([valid, invalid]);
    await assert.rejects(
      migrateAuctionStock(db, now),
      (error) =>
        error.name === "AuctionMigrationError" &&
        error.message.includes(String(invalid._id)),
    );
    assert.equal(db.writes, 0);
    assert.equal(valid.reservaStock, undefined);
  }
});
