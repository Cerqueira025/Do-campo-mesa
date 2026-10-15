import { connectDatabase, disconnectDatabase, databaseErrorMessage } from '../config/database.js';
import { initializeCollections } from '../models/index.js';

try {
  await connectDatabase();
  await initializeCollections();
  console.log('Coleções e índices MongoDB preparados.');
} catch (error) {
  console.error(databaseErrorMessage(error));
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
