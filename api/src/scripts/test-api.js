import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { cleanupBrunoData } from './cleanup-bruno.js';

const directory = dirname(fileURLToPath(import.meta.url));
const collectionPath = resolve(directory, '../../../bruno');
const cliPath = resolve(directory, '../../node_modules/@usebruno/cli/bin/bru.js');
let connected = false;
let exitCode = 1;
let brunoStarted = false;

try {
  await connectDatabase();
  connected = true;
  await cleanupBrunoData();
  await disconnectDatabase();
  connected = false;

  brunoStarted = true;
  const brunoEnv = { ...process.env };
  delete brunoEnv.MONGODB_URI;
  delete brunoEnv.MONGODB_DB_NAME;
  delete brunoEnv.JWT_SECRET;
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';
  const result = spawnSync(process.execPath, [cliPath, 'run', '.', '--env', 'local', '--env-var', `baseUrl=${baseUrl}`, '-r'], { stdio: 'inherit', env: brunoEnv, cwd: collectionPath });
  if (result.error) throw result.error;
  exitCode = result.status ?? 1;
} catch (error) {
  const reason = error.code || error.name || 'erro';
  console.error(`Não foi possível executar a coleção Bruno (${reason}).`);
} finally {
  try {
    if (!connected && brunoStarted) {
      await connectDatabase();
      connected = true;
    }
    if (connected) await cleanupBrunoData();
  } catch (error) {
    console.error(`A limpeza dos dados de teste falhou (${error.code || error.name || 'erro'}).`);
    exitCode = 1;
  } finally {
    if (connected) await disconnectDatabase();
  }
}

process.exitCode = exitCode;
