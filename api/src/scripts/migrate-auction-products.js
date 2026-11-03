import {
  connectDatabase,
  disconnectDatabase,
  databaseErrorMessage,
} from "../config/database.js";
import { migrateAuctionProducts } from "./auction-products-migration.js";

try {
  await connectDatabase();
  const count = await migrateAuctionProducts();
  console.log(`${count} leilões convertidos para listas de produtos.`);
} catch (error) {
  console.error(
    error.name === "AuctionMigrationError"
      ? error.message
      : databaseErrorMessage(error),
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
