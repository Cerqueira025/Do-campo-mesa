import Auction from "../models/Auction.js";

export async function migrateAuctionStock(
  collection = Auction.collection,
  now = Date.now(),
) {
  const documents = await collection.find({}).toArray();
  const operations = [];
  const invalid = [];
  for (const document of documents) {
    const historical =
      document.estado === "terminado" ||
      document.estado === "cancelado" ||
      new Date(document.dataFim).getTime() <= now;
    const values = Object.hasOwn(document, "reservaStock")
      ? {}
      : {
          estado: historical
            ? document.estado === "cancelado"
              ? "cancelado"
              : "terminado"
            : "agendado",
          reservaStock: historical ? "sem-reserva" : "pendente",
        };
    try {
      if (
        !["agendado", "ativo", "terminado", "cancelado"].includes(
          document.estado,
        )
      )
        throw new Error("Estado antigo inválido.");
      if (
        ["produtoId", "quantidade", "unidade"].some((key) =>
          Object.hasOwn(document, key),
        )
      )
        throw new Error("Migra primeiro a lista de produtos.");
      await new Auction({ ...document, ...values }).validate();
    } catch {
      invalid.push(String(document._id));
      continue;
    }
    if (Object.keys(values).length)
      operations.push({
        updateOne: { filter: { _id: document._id }, update: { $set: values } },
      });
  }
  if (invalid.length)
    throw Object.assign(
      new Error(
        `Migração interrompida antes de escrever. Leilões inválidos: ${invalid.join(", ")}. Confirma a migração para listas de produtos.`,
      ),
      { name: "AuctionMigrationError" },
    );
  if (!operations.length) return 0;
  return (await collection.bulkWrite(operations)).modifiedCount;
}
