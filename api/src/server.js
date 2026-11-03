import app from "./app.js";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  connectDatabase,
  disconnectDatabase,
  databaseErrorMessage,
} from "./config/database.js";
import Auction from "./models/Auction.js";
import {
  processAuctionsStock,
  scheduleAuctionsStock,
} from "./services/auctionStock.js";
import { emitAuctionTransition, registerSockets } from "./sockets/index.js";

const port = Number(process.env.PORT) || 3000;

try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET tem de ter pelo menos 32 caracteres.");
  }
  await connectDatabase();
  if (await Auction.exists({ reservaStock: { $exists: false } })) {
    throw Object.assign(
      new Error(
        "Executa npm run db:migrate:auction-stock com a API parada antes de iniciar.",
      ),
      { name: "AuctionMigrationError" },
    );
  }
  const httpServer = createServer(app);
  const io = new Server(httpServer, { transports: ["websocket"] });
  app.set("io", io);
  registerSockets(io);
  const onTransition = (event) => emitAuctionTransition(io, event);
  await processAuctionsStock(undefined, onTransition);
  httpServer.listen(port, () => {
    console.log(`API disponível em http://localhost:${port}`);
  });
  scheduleAuctionsStock(undefined, onTransition);
} catch (error) {
  console.error(
    error.name === "AuctionMigrationError"
      ? error.message
      : databaseErrorMessage(error),
  );
  await disconnectDatabase();
  process.exitCode = 1;
}
