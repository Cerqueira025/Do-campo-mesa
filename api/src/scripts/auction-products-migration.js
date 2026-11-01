import Auction from "../models/Auction.js";

export async function migrateAuctionProducts(collection = Auction.collection) {
  const documents = await collection.find({}).toArray();
  const operations = [];
  const invalidIds = [];
  for (const document of documents) {
    const hasLegacy = ["produtoId", "quantidade", "unidade"].some((key) =>
      Object.hasOwn(document, key),
    );
    const hasProducts = Object.hasOwn(document, "produtos");
    const produtos = hasProducts
      ? document.produtos
      : [
          {
            produtoId: document.produtoId,
            quantidade: document.quantidade,
            unidade: document.unidade,
          },
        ];
    try {
      if (hasLegacy && hasProducts) throw new Error("Formatos contraditórios.");
      if (
        !Array.isArray(produtos) ||
        !produtos.length ||
        produtos.some(
          (line) =>
            !line ||
            !Number.isFinite(line.quantidade) ||
            line.quantidade <= 0 ||
            !["kg", "g", "l", "unidade"].includes(line.unidade),
        )
      )
        throw new Error("Linhas inválidas.");
      // Reservation migration runs separately, after this structural conversion.
      const validationReserve =
        document.estado === "agendado"
          ? "pendente"
          : document.estado === "ativo"
            ? "reservada"
            : "sem-reserva";
      await new Auction({
        ...document,
        produtos,
        reservaStock: document.reservaStock ?? validationReserve,
      }).validate();
    } catch {
      invalidIds.push(String(document._id));
      continue;
    }
    if (!hasProducts)
      operations.push({
        updateOne: {
          filter: { _id: document._id },
          update: {
            $set: { produtos },
            $unset: { produtoId: "", quantidade: "", unidade: "" },
          },
        },
      });
  }
  if (invalidIds.length) {
    throw Object.assign(
      new Error(
        `Migração interrompida antes de escrever. Leilões inválidos: ${invalidIds.join(", ")}.`,
      ),
      {
        name: "AuctionMigrationError",
      },
    );
  }
  if (!operations.length) return 0;
  const result = await collection.bulkWrite(operations);
  return result.modifiedCount;
}
