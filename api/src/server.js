import app from './app.js';
import { connectDatabase, disconnectDatabase, databaseErrorMessage } from './config/database.js';
import Auction from './models/Auction.js';
import { processAuctionsStock, scheduleAuctionsStock } from './services/auctionStock.js';

const port = Number(process.env.PORT) || 3000;

try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET tem de ter pelo menos 32 caracteres.');
  }
  await connectDatabase();
  if (await Auction.exists({ reservaStock: { $exists: false } })) {
    throw Object.assign(new Error('Executa npm run db:migrate:auction-stock com a API parada antes de iniciar.'), { name: 'AuctionMigrationError' });
  }
  await processAuctionsStock();
  app.listen(port, () => {
    console.log(`API disponível em http://localhost:${port}`);
  });
  scheduleAuctionsStock();
} catch (error) {
  console.error(error.name === 'AuctionMigrationError' ? error.message : databaseErrorMessage(error));
  await disconnectDatabase();
  process.exitCode = 1;
}
