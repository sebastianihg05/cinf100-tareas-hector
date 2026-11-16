import type { PoolClient } from 'pg';
import { pool } from '../db';
import { aErrorDeConflicto, ErrorReserva, SQL_VIAJE_NO_SALIO } from './servicio';

// S3-RES-03 (#2607): el funcionario cancela su reserva o cambia el asiento.

export interface TrayectoReserva {
  id: number;
  viajeId: number;
  trayecto: string;
  fecha: string;
  hora: string;
  origen: string;
  destino: string;
  asiento: number;
  estado: string;
}

export interface GrupoReserva {
  grupoId: string;
  reservas: TrayectoReserva[];
}

interface FilaPropia {
  id: number;
  viaje_id: number;
  capacidad: number;
  // reserva pendiente de un viaje pendiente que todavía no sale
  editable: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_EDITABLE = 'Esta reserva ya no se puede modificar: el viaje ya salió, se canceló o la reserva no está pendiente.';

const esIdValido = (valor: unknown): valor is number => Number.isInteger(valor) && (valor as number) > 0;

// Trayectos del grupo que son de la persona, con sus filas bloqueadas hasta terminar la transacción.
async function trayectosPropios(cliente: PoolClient, usuarioId: number, grupoId: string): Promise<Map<number, FilaPropia>> {
  // Un id con otro formato no existe; se responde igual que una reserva ajena.
  if (!UUID.test(grupoId)) throw new ErrorReserva('La reserva no existe.', 404);

  const { rows } = await cliente.query<FilaPropia>(
    `SELECT r.id, r.viaje_id, COALESCE(va.capacidad, 0) AS capacidad,
            (r.estado = 'pendiente' AND v.estado = 'pendiente' AND ${SQL_VIAJE_NO_SALIO}) AS editable
       FROM reservas r
       JOIN viajes v ON v.id = r.viaje_id
       LEFT JOIN vans va ON va.id = v.van_id
      WHERE r.grupo_id = $1 AND r.usuario_id = $2
      ORDER BY r.id
      FOR UPDATE OF r`,
    [grupoId, usuarioId]
  );
  // Ajena o inexistente: 404, para no revelar que la reserva existe.
  if (rows.length === 0) throw new ErrorReserva('La reserva no existe.', 404);
  return new Map(rows.map((fila) => [fila.id, fila]));
}

async function leerGrupo(cliente: PoolClient, grupoId: string): Promise<GrupoReserva> {
  const { rows } = await cliente.query<TrayectoReserva>(
    `SELECT r.id, r.viaje_id AS "viajeId", v.trayecto,
            to_char(v.fecha, 'YYYY-MM-DD') AS fecha, to_char(v.hora, 'HH24:MI') AS hora,
            v.origen, v.destino, r.asiento, r.estado
       FROM reservas r
       JOIN viajes v ON v.id = r.viaje_id
      WHERE r.grupo_id = $1
      ORDER BY v.fecha, v.hora`,
    [grupoId]
  );
  return { grupoId, reservas: rows };
}

// Ejecuta `accion` en una transacción y devuelve el grupo actualizado.
async function enTransaccion(
  grupoId: string,
  accion: (cliente: PoolClient) => Promise<void>
): Promise<GrupoReserva> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await accion(cliente);
    const grupo = await leerGrupo(cliente, grupoId);
    await cliente.query('COMMIT');
    return grupo;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw aErrorDeConflicto(error) ?? error;
  } finally {
    cliente.release();
  }
}

// Cancela los trayectos indicados, o todos los que se puedan si no se indica ninguno. Libera sus asientos.
export async function cancelarReserva(usuarioId: number, grupoId: string, reservaIds?: unknown): Promise<GrupoReserva> {
  if (reservaIds !== undefined) {
    if (!Array.isArray(reservaIds) || reservaIds.length === 0 || !reservaIds.every(esIdValido)
      || new Set(reservaIds).size !== reservaIds.length) {
      throw new ErrorReserva('Indica los trayectos a cancelar con sus ids, sin repetirlos.');
    }
  }

  return enTransaccion(grupoId, async (cliente) => {
    const propios = await trayectosPropios(cliente, usuarioId, grupoId);
    const elegidos = (reservaIds as number[] | undefined) ?? [...propios.values()].filter((t) => t.editable).map((t) => t.id);

    if (elegidos.length === 0) throw new ErrorReserva(NO_EDITABLE, 409);
    for (const id of elegidos) {
      const trayecto = propios.get(id);
      if (!trayecto) throw new ErrorReserva('La reserva no existe.', 404);
      if (!trayecto.editable) throw new ErrorReserva(NO_EDITABLE, 409);
    }

    await cliente.query(
      `UPDATE reservas SET estado = 'cancelada', cancelada_en = CURRENT_TIMESTAMP WHERE id = ANY($1)`,
      [elegidos]
    );
  });
}

// Cambia el asiento de uno o dos trayectos del grupo; el asiento anterior queda libre.
export async function cambiarAsientos(usuarioId: number, grupoId: string, cambios: unknown): Promise<GrupoReserva> {
  if (!Array.isArray(cambios) || cambios.length === 0 || cambios.length > 2
    || !cambios.every((c) => c && typeof c === 'object' && esIdValido(c.reservaId) && Number.isInteger(c.asiento))) {
    throw new ErrorReserva('Indica uno o dos cambios, cada uno con reservaId y asiento enteros.');
  }
  const lista = cambios as { reservaId: number; asiento: number }[];
  if (new Set(lista.map((c) => c.reservaId)).size !== lista.length) {
    throw new ErrorReserva('No repitas un mismo trayecto.');
  }

  return enTransaccion(grupoId, async (cliente) => {
    const propios = await trayectosPropios(cliente, usuarioId, grupoId);
    for (const { reservaId, asiento } of lista) {
      const trayecto = propios.get(reservaId);
      if (!trayecto) throw new ErrorReserva('La reserva no existe.', 404);
      if (!trayecto.editable) throw new ErrorReserva(NO_EDITABLE, 409);
      if (asiento < 1 || asiento > trayecto.capacidad) {
        throw new ErrorReserva(`El asiento ${asiento} no existe en la van de este viaje.`);
      }
    }

    for (const { reservaId, asiento } of lista) {
      await cliente.query('UPDATE reservas SET asiento = $2 WHERE id = $1', [reservaId, asiento]);
    }
  });
}

// S3-RES-04 (#2608): reservas de la persona para la pantalla "Mis reservas".
export interface MiTrayecto extends TrayectoReserva {
  estadoViaje: string;
  // se puede cancelar o cambiar de asiento (mismas reglas que trayectosPropios)
  editable: boolean;
  capacidad: number;
  // asientos que tienen otras personas en ese viaje, para elegir uno nuevo al editar
  ocupados: number[];
  // cuándo se hizo la reserva; ordena los avisos de la campana
  creadaEn: string;
}

export async function listarMisReservas(usuarioId: number): Promise<{ grupoId: string; reservas: MiTrayecto[] }[]> {
  const { rows } = await pool.query<MiTrayecto & { grupoId: string }>(
    `SELECT r.id, r.grupo_id AS "grupoId", r.viaje_id AS "viajeId", v.trayecto,
            to_char(v.fecha, 'YYYY-MM-DD') AS fecha, to_char(v.hora, 'HH24:MI') AS hora,
            v.origen, v.destino, r.asiento, r.estado, v.estado AS "estadoViaje",
            (r.estado = 'pendiente' AND v.estado = 'pendiente' AND ${SQL_VIAJE_NO_SALIO}) AS editable,
            COALESCE(va.capacidad, 0) AS capacidad,
            COALESCE((SELECT ARRAY_AGG(o.asiento ORDER BY o.asiento) FROM reservas o
                       WHERE o.viaje_id = r.viaje_id AND o.estado <> 'cancelada' AND o.id <> r.id), '{}') AS ocupados,
            r.creado_en AS "creadaEn"
       FROM reservas r
       JOIN viajes v ON v.id = r.viaje_id
       LEFT JOIN vans va ON va.id = v.van_id
      WHERE r.usuario_id = $1
      ORDER BY v.fecha, v.hora, r.id`,
    [usuarioId]
  );

  // Se agrupan por grupo_id; la ida queda antes que la vuelta por el ORDER BY.
  const grupos = new Map<string, MiTrayecto[]>();
  for (const { grupoId, ...trayecto } of rows) {
    grupos.set(grupoId, [...(grupos.get(grupoId) ?? []), trayecto]);
  }
  return [...grupos].map(([grupoId, reservas]) => ({ grupoId, reservas }));
}
