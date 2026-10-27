import { Pool } from 'pg';
import { config } from './config';

// Pool reutilizable para las consultas a PostgreSQL
export const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (error) => {
  console.error('Error inesperado en la conexión con PostgreSQL:', error.message);
});