import express, { type ErrorRequestHandler } from 'express';
import { pool } from './db';
import { rutasAuth } from './usuarios/rutas';

export const app = express();

app.use(express.json());

app.use('/api/auth', rutasAuth);

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

// Errores no controlados: responde JSON y no expone detalles internos.
const manejarErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor.' });
};

app.use(manejarErrores);