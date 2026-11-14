import { Router } from 'express';
import { requiereRol, requiereSesion } from '../auth/middleware';
import { pool } from '../db';
import { DIAS_MAX_ANTICIPACION, DIAS_MIN_ANTICIPACION, SQL_DIAS_HASTA_VIAJE } from './servicio';

// S3-RES-01 (#2605): viajes que el funcionario puede reservar y los asientos ocupados de cada uno.
export const rutasViajesDisponibles = Router();

rutasViajesDisponibles.use(requiereSesion, requiereRol('funcionario'));

// Mismas condiciones que revisa la creación de la reserva (servicio.ts).
const RESERVABLE = `v.estado = 'pendiente' AND va.activa
  AND ${SQL_DIAS_HASTA_VIAJE} BETWEEN ${DIAS_MIN_ANTICIPACION} AND ${DIAS_MAX_ANTICIPACION}`;

// Un asiento está ocupado mientras su reserva no esté cancelada (igual que el índice único de 005_reservas.sql).
const RESERVAS_ACTIVAS = `LEFT JOIN reservas r ON r.viaje_id = v.id AND r.estado <> 'cancelada'`;

const TRAYECTOS = ['Ida', 'Vuelta'];

// AAAA-MM-DD y que sea un día real (rechaza, por ejemplo, 2026-02-31).
function esFecha(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

type FilaDisponible = {
  id: number;
  fecha: string;
  hora: string;
  trayecto: string;
  origen: string;
  destino: string;
  capacidad: number;
  ocupados: number;
  tengo_reserva: boolean;
};

// Lista los viajes reservables, del más cercano al más lejano. Filtros opcionales: ?fecha= y ?trayecto=
rutasViajesDisponibles.get('/disponibles', async (req, res) => {
  const { fecha, trayecto } = req.query;
  const errores: Record<string, string> = {};
  if (fecha !== undefined && !esFecha(fecha)) {
    errores.fecha = 'La fecha debe ser un día válido con el formato AAAA-MM-DD.';
  }
  if (trayecto !== undefined && !(typeof trayecto === 'string' && TRAYECTOS.includes(trayecto))) {
    errores.trayecto = 'El trayecto debe ser Ida o Vuelta.';
  }
  if (Object.keys(errores).length > 0) {
    res.status(400).json({ errores });
    return;
  }

  const { rows } = await pool.query<FilaDisponible>(
    `SELECT v.id, to_char(v.fecha, 'YYYY-MM-DD') AS fecha, to_char(v.hora, 'HH24:MI') AS hora,
            v.trayecto, v.origen, v.destino, va.capacidad,
            COUNT(r.id)::int AS ocupados,
            COALESCE(BOOL_OR(r.usuario_id = $3), FALSE) AS tengo_reserva
       FROM viajes v
       JOIN vans va ON va.id = v.van_id
       ${RESERVAS_ACTIVAS}
      WHERE ${RESERVABLE}
        AND ($1::date IS NULL OR v.fecha = $1::date)
        AND ($2::varchar IS NULL OR v.trayecto = $2::varchar)
      GROUP BY v.id, va.capacidad
      ORDER BY v.fecha, v.hora`,
    [fecha ?? null, trayecto ?? null, req.usuario!.id]
  );

  res.json({
    viajes: rows.map((v) => ({
      id: v.id,
      fecha: v.fecha,
      hora: v.hora,
      trayecto: v.trayecto,
      origen: v.origen,
      destino: v.destino,
      capacidad: v.capacidad,
      ocupados: v.ocupados,
      libres: Math.max(0, v.capacidad - v.ocupados),
      tengoReserva: v.tengo_reserva,
    })),
  });
});

// Capacidad y asientos ocupados de un viaje reservable, y el asiento propio si ya reservó ahí.
rutasViajesDisponibles.get('/:id/asientos', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El id del viaje no es válido.' });
    return;
  }

  const { rows } = await pool.query<{ capacidad: number; ocupados: number[]; mi_asiento: number | null }>(
    `SELECT va.capacidad,
            COALESCE(ARRAY_AGG(r.asiento ORDER BY r.asiento) FILTER (WHERE r.id IS NOT NULL), '{}') AS ocupados,
            MAX(r.asiento) FILTER (WHERE r.usuario_id = $2) AS mi_asiento
       FROM viajes v
       JOIN vans va ON va.id = v.van_id
       ${RESERVAS_ACTIVAS}
      WHERE v.id = $1 AND ${RESERVABLE}
      GROUP BY va.capacidad`,
    [id, req.usuario!.id]
  );

  if (rows.length === 0) {
    const existe = await pool.query('SELECT 1 FROM viajes WHERE id = $1', [id]);
    if (existe.rowCount === 0) {
      res.status(404).json({ error: 'El viaje no existe.' });
    } else {
      res.status(409).json({ error: 'El viaje no está disponible para reservas.' });
    }
    return;
  }

  const [viaje] = rows;
  res.json({ viajeId: id, capacidad: viaje.capacidad, ocupados: viaje.ocupados, miAsiento: viaje.mi_asiento });
});
