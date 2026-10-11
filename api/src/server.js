import app from './app.js';
import { connectDatabase, disconnectDatabase, databaseErrorMessage } from './config/database.js';

const port = Number(process.env.PORT) || 3000;

try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET tem de ter pelo menos 32 caracteres.');
  }
  await connectDatabase();
  app.listen(port, () => {
    console.log(`API disponível em http://localhost:${port}`);
  });
} catch (error) {
  console.error(databaseErrorMessage(error));
  await disconnectDatabase();
  process.exitCode = 1;
}
