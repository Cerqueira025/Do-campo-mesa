import { connectDatabase, disconnectDatabase, databaseErrorMessage } from '../config/database.js';
import { migrateAuctionStock } from './auction-stock-migration.js';

try {
  await connectDatabase();
  console.log(`${await migrateAuctionStock()} leilões preparados para o ciclo de reservas.`);
} catch (error) {
  console.error(error.name === 'AuctionMigrationError' ? error.message : databaseErrorMessage(error));
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
