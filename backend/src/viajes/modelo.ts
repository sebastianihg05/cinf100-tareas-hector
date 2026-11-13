import { pool } from '../db';

export type EstadoViaje = 'pendiente' | 'en-curso' | 'completado' | 'cancelado';
export type EstadoReserva = 'pendiente' | 'completada' | 'cancelada';

// Columnas de un viaje tal como las usa la API (la hora sin segundos y la fecha como texto, sin zona horaria).
export const COLUMNAS_VIAJE = `
  v.id, TO_CHAR(v.fecha, 'YYYY-MM-DD') AS fecha, TO_CHAR(v.hora, 'HH24:MI') AS hora,
  v.trayecto, v.origen, v.destino, v.van_id, v.conductor_id, v.estado,
  v.iniciado_en, v.finalizado_en, v.cancelado_en`;

export type FilaViaje = {
  id: number;
  fecha: string;
  hora: string;
  trayecto: 'Ida' | 'Vuelta';
  origen: string;
  destino: string;
  van_id: number | null;
  conductor_id: number | null;
  estado: EstadoViaje;
  iniciado_en: Date | null;
  finalizado_en: Date | null;
  cancelado_en: Date | null;
};

type FilaReserva = {
  id: number;
  viaje_id: number;
  grupo_id: string;
  usuario_id: number;
  nombre_completo: string;
  telefono: string;
  asiento: number;
  estado: EstadoReserva;
  creado_en: Date;
};

// Un asiento reservado con los datos que necesitan el administrador y el conductor.
export type ReservaViaje = {
  id: number;
  grupoId: string;
  usuarioId: number;
  nombre: string;
  telefono: string;
  asiento: number;
  estado: EstadoReserva;
  creadaEn: Date;
};

export type Viaje = {
  id: number;
  fecha: string;
  hora: string;
  trayecto: 'Ida' | 'Vuelta';
  origen: string;
  destino: string;
  vanId: number | null;
  conductorId: number | null;
  estado: EstadoViaje;
  iniciadoEn: Date | null;
  finalizadoEn: Date | null;
  canceladoEn: Date | null;
  reservas: ReservaViaje[];
};

function aViaje(fila: FilaViaje, reservas: ReservaViaje[]): Viaje {
  return {
    id: fila.id,
    fecha: fila.fecha,
    hora: fila.hora,
    trayecto: fila.trayecto,
    origen: fila.origen,
    destino: fila.destino,
    vanId: fila.van_id,
    conductorId: fila.conductor_id,
    estado: fila.estado,
    iniciadoEn: fila.iniciado_en,
    finalizadoEn: fila.finalizado_en,
    canceladoEn: fila.cancelado_en,
    reservas,
  };
}

// Agrega a cada viaje sus reservas (con nombre y celular del pasajero), ordenadas por asiento.
export async function conReservas(filas: FilaViaje[]): Promise<Viaje[]> {
  if (filas.length === 0) return [];
  const { rows } = await pool.query<FilaReserva>(
    `SELECT r.id, r.viaje_id, r.grupo_id, r.usuario_id, u.nombre_completo, u.telefono, r.asiento, r.estado, r.creado_en
       FROM reservas r JOIN usuarios u ON u.id = r.usuario_id
      WHERE r.viaje_id = ANY($1::int[])
      ORDER BY r.asiento`,
    [filas.map((f) => f.id)]
  );
  const porViaje = new Map<number, ReservaViaje[]>();
  for (const r of rows) {
    const lista = porViaje.get(r.viaje_id) ?? [];
    lista.push({
      id: r.id,
      grupoId: r.grupo_id,
      usuarioId: r.usuario_id,
      nombre: r.nombre_completo,
      telefono: r.telefono,
      asiento: r.asiento,
      estado: r.estado,
      creadaEn: r.creado_en,
    });
    porViaje.set(r.viaje_id, lista);
  }
  return filas.map((f) => aViaje(f, porViaje.get(f.id) ?? []));
}

// Un viaje por id, con sus reservas; `undefined` si no existe.
export async function viajePorId(id: number): Promise<Viaje | undefined> {
  const { rows } = await pool.query<FilaViaje>(`SELECT ${COLUMNAS_VIAJE} FROM viajes v WHERE v.id = $1`, [id]);
  return (await conReservas(rows))[0];
}

// Valida el :id de la ruta. Responde 400 desde el llamador cuando devuelve null.
export function idValido(valor: string): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}
