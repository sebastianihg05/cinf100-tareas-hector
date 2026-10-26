import express from 'express';
import { pool } from './db';

export const app = express();

app.use(express.json());

// Estado de la API y de la conexión con PostgreSQL
app.get('/api/health', async (_req, res) => {
  try {
    const { rows } = await pool.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    res.json({
      status: 'ok',
      database: 'conectada',
      migraciones: rows.map((row) => row.version),
    });
  } catch {
    res.status(503).json({ status: 'error', database: 'sin conexión' });
  }
});
