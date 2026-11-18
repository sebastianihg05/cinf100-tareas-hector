
import { Router } from 'express';
import { pool } from '../db';
import { COLUMNAS_VIAJE, conReservas, idValido, viajePorId, type FilaViaje } from '../viajes/modelo';

// Gestión administrativa de viajes (S3-VIA-03). Solo administradores: se monta en rutasAdmin.
export const rutasViajes = Router();

// Ruta y horario fijos de cada trayecto.
const TRAYECTOS = {
  Ida: { origen: 'Quillota 980', destino: 'Santiago', hora: '06:45' },
  Vuelta: { origen: 'Santiago', destino: 'Quillota 980', hora: '17:00' },
} as const;
type Trayecto = keyof typeof TRAYECTOS;

// Un viaje se abre con 1 a 30 días de anticipación.
const DIAS_MIN = 1;
const DIAS_MAX = 30;

function esFechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(valor);
}

// Todos los viajes con sus reservas.
rutasViajes.get('/', async (_req, res) => {
  const { rows } = await pool.query<FilaViaje>(
    `SELECT ${COLUMNAS_VIAJE} FROM viajes v ORDER BY v.fecha, v.hora, v.id`
  );
  res.json({ viajes: await conReservas(rows) });
});

// Abre uno o dos viajes en una fecha. Se guardan juntos o ninguno.
rutasViajes.post('/', async (req, res) => {
  const cuerpo = (req.body ?? {}) as { fecha?: unknown; trayectos?: unknown };

  if (typeof cuerpo.fecha !== 'string' || !esFechaValida(cuerpo.fecha)) {
    res.status(400).json({ errores: { fecha: 'Indica la fecha del viaje con el formato AAAA-MM-DD.' } });
    return;
  }

  const trayectos = cuerpo.trayectos;
  const validos =
    Array.isArray(trayectos) &&
    trayectos.length >= 1 &&
    trayectos.length <= 2 &&
    new Set(trayectos).size === trayectos.length &&
    trayectos.every((t) => t === 'Ida' || t === 'Vuelta');

  if (!validos) {
    res.status(400).json({ errores: { trayectos: 'Elige Ida, Vuelta o ambos trayectos.' } });
    return;
  }

  const { rows: rango } = await pool.query<{ ok: boolean }>(
    `SELECT $1::date BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date + $2::int
                         AND (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date + $3::int AS ok`,
    [cuerpo.fecha, DIAS_MIN, DIAS_MAX]
  );

  if (!rango[0].ok) {
    res.status(400).json({ errores: { fecha: `La fecha debe estar entre ${DIAS_MIN} y ${DIAS_MAX} días desde hoy.` } });
    return;
  }

  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    const ids: number[] = [];

    for (const trayecto of trayectos as Trayecto[]) {
      const t = TRAYECTOS[trayecto];

      const { rows } = await cliente.query<{ id: number }>(
        `INSERT INTO viajes (fecha, hora, trayecto, origen, destino, creado_por)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [cuerpo.fecha, t.hora, trayecto, t.origen, t.destino, req.usuario!.id]
      );

      ids.push(rows[0].id);
    }

    await cliente.query('COMMIT');

    const { rows } = await pool.query<FilaViaje>(
      `SELECT ${COLUMNAS_VIAJE} FROM viajes v WHERE v.id = ANY($1::int[]) ORDER BY v.hora`,
      [ids]
    );

    res.status(201).json({ viajes: await conReservas(rows) });
  } catch (error) {
    await cliente.query('ROLLBACK');

    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Ya hay un viaje abierto ese día para el trayecto elegido.' });
      return;
    }

    throw error;
  } finally {
    cliente.release();
  }
});

// Asigna van y conductor a un viaje pendiente, o lo cancela.
rutasViajes.patch('/:id', async (req, res) => {
  const id = idValido(req.params.id);

  if (id === null) {
    res.status(400).json({ error: 'El id del viaje no es válido.' });
    return;
  }

  const cuerpo = (req.body ?? {}) as { vanId?: unknown; conductorId?: unknown; estado?: unknown };
  const asigna = cuerpo.vanId !== undefined || cuerpo.conductorId !== undefined;
  const cambiaEstado = cuerpo.estado !== undefined;

  if (asigna === cambiaEstado) {
    res.status(400).json({ error: 'Indica la asignación de van y conductor, o bien el cambio de estado.' });
    return;
  }

  if (cambiaEstado && cuerpo.estado !== 'cancelado') {
    res.status(400).json({ errores: { estado: 'Desde la administración un viaje solo se puede cancelar.' } });
    return;
  }

  const entero = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0;

  if (asigna) {
    const errores: Record<string, string> = {};

    if (cuerpo.vanId !== undefined && cuerpo.vanId !== null && !entero(cuerpo.vanId)) {
      errores.vanId = 'La van no es válida.';
    }

    if (cuerpo.conductorId !== undefined && cuerpo.conductorId !== null && !entero(cuerpo.conductorId)) {
      errores.conductorId = 'El conductor no es válido.';
    }

    if (Object.keys(errores).length > 0) {
      res.status(400).json({ errores });
      return;
    }
  }

  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    const { rows } = await cliente.query<{ estado: string }>(
      'SELECT estado FROM viajes WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (rows.length === 0) {
      await cliente.query('ROLLBACK');
      res.status(404).json({ error: 'El viaje no existe.' });
      return;
    }

    if (rows[0].estado !== 'pendiente') {
      await cliente.query('ROLLBACK');
      res.status(409).json({ error: 'Solo se puede modificar un viaje pendiente.' });
      return;
    }

    if (cambiaEstado) {
      await cliente.query(
        `UPDATE viajes SET estado = 'cancelado', cancelado_en = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );

      // Registra quién canceló el viaje y cuándo, dentro de la misma transacción.
      await cliente.query(
        `INSERT INTO viajes_historial_estados
          (viaje_id, estado_anterior, estado_nuevo, usuario_id)
         VALUES ($1, 'pendiente', 'cancelado', $2)`,
        [id, req.usuario!.id]
      );

      // Las reservas pendientes se cancelan junto con el viaje.
      await cliente.query(
        `UPDATE reservas SET estado = 'cancelada', cancelada_en = CURRENT_TIMESTAMP
          WHERE viaje_id = $1 AND estado = 'pendiente'`,
        [id]
      );
    } else {
      const vanId = (cuerpo.vanId as number | null | undefined) ?? null;

      if (vanId !== null) {
        const { rowCount } = await cliente.query(
          'SELECT 1 FROM vans WHERE id = $1 AND activa',
          [vanId]
        );

        if (rowCount === 0) {
          await cliente.query('ROLLBACK');
          res.status(400).json({ errores: { vanId: 'La van no existe o está dada de baja.' } });
          return;
        }
      }

      const conductorId = (cuerpo.conductorId as number | null | undefined) ?? null;

      if (conductorId !== null) {
        const { rowCount } = await cliente.query(
          'SELECT 1 FROM conductores WHERE usuario_id = $1 AND activo',
          [conductorId]
        );

        if (rowCount === 0) {
          await cliente.query('ROLLBACK');
          res.status(400).json({ errores: { conductorId: 'El conductor no existe o está inactivo.' } });
          return;
        }
      }

      await cliente.query(
        'UPDATE viajes SET van_id = $2, conductor_id = $3 WHERE id = $1',
        [id, vanId, conductorId]
      );
    }

    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }

  res.json({ viaje: await viajePorId(id) });
});
