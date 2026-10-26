import path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Carga backend/.env (funciona desde src/ y desde dist/).
// Las variables ya definidas, como en el CI, no se sobrescriben.
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Falta DATABASE_URL. Configúrala en backend/.env');
}

// Pool reutilizable para las consultas a PostgreSQL
export const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (error) => {
  console.error('Error inesperado en la conexión con PostgreSQL:', error.message);
});
