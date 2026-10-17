import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import mongoose from 'mongoose';

const envPath = new URL('../../.env', import.meta.url);
if (existsSync(envPath)) loadEnvFile(envPath);

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Configura MONGODB_URI em api/.env.');
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || 'do_campo_a_mesa',
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
    autoCreate: false,
  });
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export function databaseErrorMessage(error) {
  if (!process.env.MONGODB_URI) return 'Configura MONGODB_URI em api/.env.';
  if (error.name === 'SeedConflictError') return error.message;
  if (error.code === 11000) return 'Existe um valor duplicado num índice único.';
  if (error.name === 'ValidationError') return 'Dados inválidos para o schema.';
  return 'Não foi possível concluir a operação MongoDB. Verifica a configuração, as credenciais e o acesso de rede ao Atlas.';
}
