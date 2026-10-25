const path = require('node:path');
const { Pool } = require('pg');

// Cargar las variables desde backend/.env
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'Falta DATABASE_URL. Configúrala en backend/.env'
  );
}

// Pool reutilizable para las consultas a PostgreSQL
const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (error) => {
  console.error(
    'Error inesperado en la conexión con PostgreSQL:',
    error.message
  );
});

module.exports = { pool };