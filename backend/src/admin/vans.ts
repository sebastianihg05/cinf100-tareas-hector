
import { Router } from 'express';
import { pool } from '../db';

export const rutasVans = Router();

type FilaVan = {
  id: number;
  patente: string;
  capacidad: number;
  activa: boolean;
  conductor_id: number | null;
};

function aVan(fila: FilaVan) {
  return {
    id: String(fila.id),
    patente: fila.patente,
    asientos: fila.capacidad,
    conductorId: fila.conductor_id,
    activa: fila.activa,
  };
}

const COLUMNAS = 'id, patente, capacidad, activa, conductor_id';

rutasVans.get('/', async (_req, res) => {
  const { rows } = await pool.query<FilaVan>(
    `SELECT ${COLUMNAS} FROM vans ORDER BY id`
  );
  res.json({ vans: rows.map(aVan) });
});

rutasVans.post('/', async (req, res) => {
  const cuerpo = req.body ?? {};
  const patente = typeof cuerpo.patente === 'string'
    ? cuerpo.patente.trim().toUpperCase()
    : '';
  const conductorId = cuerpo.conductorId;

  if (!/^([A-Z]{2}-[0-9]{4}|[A-Z]{4}-[0-9]{2})$/.test(patente)) {
    res.status(400).json({ error: 'La patente no tiene un formato válido.' });
    return;
  }

  if (conductorId !== undefined && conductorId !== null &&
    (!Number.isInteger(conductorId) || conductorId <= 0)) {
    res.status(400).json({ error: 'El conductor indicado no es válido.' });
    return;
  }

  try {
    const { rows } = await pool.query<FilaVan>(
      `INSERT INTO vans (patente, capacidad, conductor_id)
       VALUES ($1, 9, $2)
       RETURNING ${COLUMNAS}`,
      [patente, conductorId]
    );
    res.status(201).json({ van: aVan(rows[0]) });
  } catch (error) {
    const codigo = (error as { code?: string }).code;
    if (codigo === '23505') {
      res.status(409).json({ error: 'La patente o el conductor ya están asignados a otra van.' });
      return;
    }
    if (codigo === '23503' || codigo === '23514') {
      res.status(400).json({ error: 'El conductor no existe, está inactivo o la asignación no es válida.' });
      return;
    }
    throw error;
  }
});

rutasVans.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El id de la van no es válido.' });
    return;
  }

  const cuerpo = req.body ?? {};
  const patente = typeof cuerpo.patente === 'string'
    ? cuerpo.patente.trim().toUpperCase()
    : undefined;
  const conductorId = cuerpo.conductorId;
  const activa = cuerpo.activa;

  if (patente !== undefined && !/^([A-Z]{2}-[0-9]{4}|[A-Z]{4}-[0-9]{2})$/.test(patente)) {
    res.status(400).json({ error: 'La patente no tiene un formato válido.' });
    return;
  }
  if (conductorId !== undefined && conductorId !== null &&
      (!Number.isInteger(conductorId) || conductorId <= 0)) {
    res.status(400).json({ error: 'El conductor indicado no es válido.' });
    return;
  }
  if (activa !== undefined && typeof activa !== 'boolean') {
    res.status(400).json({ error: 'El estado de la van no es válido.' });
    return;
  }

  if (activa === false && conductorId !== undefined && conductorId !== null) {
    res.status(400).json({ error: 'Una van dada de baja no puede tener conductor.' });
    return;
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const actual = await cliente.query<FilaVan>(
      `SELECT ${COLUMNAS} FROM vans WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (actual.rowCount === 0) {
      await cliente.query('ROLLBACK');
      res.status(404).json({ error: 'La van no existe.' });
      return;
    }

    const van = actual.rows[0];
    const nuevaPatente = patente ?? van.patente;
    const nuevoEstado = activa ?? van.activa;
    const nuevoConductor = nuevoEstado
      ? (conductorId !== undefined ? conductorId : van.conductor_id)
      : null;

    const { rows } = await cliente.query<FilaVan>(
      `UPDATE vans
          SET patente = $2, activa = $3, conductor_id = $4
        WHERE id = $1
        RETURNING ${COLUMNAS}`,
      [id, nuevaPatente, nuevoEstado, nuevoConductor]
    );

    await cliente.query('COMMIT');
    res.json({ van: aVan(rows[0]) });
  } catch (error) {
    await cliente.query('ROLLBACK');
    const codigo = (error as { code?: string }).code;

    if (codigo === '23505') {
      res.status(409).json({ error: 'La patente o el conductor ya están asignados a otra van.' });
      return;
    }
    if (codigo === '23503' || codigo === '23514') {
      res.status(400).json({ error: 'El conductor no existe, está inactivo o la asignación no es válida.' });
      return;
    }
    throw error;
  } finally {
    cliente.release();
  }
});
