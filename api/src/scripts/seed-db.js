import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase, databaseErrorMessage } from '../config/database.js';
import { initializeCollections } from '../models/index.js';
import { seedData, insertSeedData } from './seed-data.js';

try {
  await connectDatabase();
  await initializeCollections();
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD || 'CampoMesaDemo123!', 12);
  const counts = await insertSeedData(seedData(passwordHash));
  for (const [collection, inserted] of Object.entries(counts)) {
    console.log(`${collection}: ${inserted} documentos inseridos; existentes preservados.`);
  }
} catch (error) {
  console.error(databaseErrorMessage(error));
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
