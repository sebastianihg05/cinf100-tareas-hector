import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { rutasAdmin } from './admin/rutas';
import { config } from './config';
import { pool } from './db';
import { rutasAuth } from './usuarios/rutas';
import { rutasPerfil } from './usuarios/rutas-perfil';
import { rutasReservas } from './reservas/rutas';

export const app = express();

// Permite que el frontend (Vite) llame a la API desde el navegador.
app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json());

app.use('/api/auth', rutasAuth);
app.use('/api/usuarios', rutasPerfil);
app.use('/api/admin', rutasAdmin);
app.use('/api/reservas', rutasReservas);

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