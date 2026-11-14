
import type { Pool, PoolClient } from 'pg';
import { pool } from '../db';
import { servicioCorreo } from '../notificaciones/servicio-correo';
import {
  crearPlantillaHTML,
  crearPlantillaTexto,
} from '../notificaciones/plantillas-correo';

export interface SolicitudReserva {
  viajeId: number;
  asiento: number;
}

export interface ResultadoReserva {
  grupoId: string;
  reservas: {
    id: number;
    viajeId: number;
    asiento: number;
    fecha: string;
    hora: string;
    trayecto: string;
    origen: string;
    destino: string;
  }[];
}

export class ErrorReserva extends Error {
  constructor(
    mensaje: string,
    public readonly codigo: number = 400
  ) {
    super(mensaje);
    this.name = 'ErrorReserva';
  }
}

// HU-03: un viaje se reserva con 1 a 30 días de anticipación (igual que el frontend).
export const DIAS_MIN_ANTICIPACION = 1;
export const DIAS_MAX_ANTICIPACION = 30;

interface DatosViaje {
  id: number;
  fecha: string;
  hora: string;
  trayecto: string;
  origen: string;
  destino: string;
  estado: string;
  capacidad: number;
  activa: boolean;
  // días que faltan para el viaje, contados con la fecha de Chile
  dias: number;
}

async function validarViaje(
  cliente: PoolClient,
  viajeId: number,
  asiento: number
): Promise<DatosViaje> {
  if (!Number.isInteger(viajeId) || viajeId <= 0) {
    throw new ErrorReserva('El identificador del viaje no es válido.');
  }

  if (!Number.isInteger(asiento) || asiento < 1 || asiento > 9) {
    throw new ErrorReserva('El número de asiento no es válido.');
  }

  const { rows } = await cliente.query(
    `SELECT
       v.id,
       to_char(v.fecha, 'YYYY-MM-DD') AS fecha,
       to_char(v.hora, 'HH24:MI') AS hora,
       v.trayecto,
       v.origen,
       v.destino,
       v.estado,
       COALESCE(va.capacidad, 0) AS capacidad,
       COALESCE(va.activa, FALSE) AS activa,
       v.fecha - (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date AS dias
     FROM viajes v
     LEFT JOIN vans va ON va.id = v.van_id
     WHERE v.id = $1
     FOR UPDATE OF v`,
    [viajeId]
  );

  if (rows.length === 0) {
    throw new ErrorReserva('El viaje seleccionado no existe.', 404);
  }

  const viaje = rows[0] as DatosViaje;

  if (viaje.estado !== 'pendiente') {
    throw new ErrorReserva('El viaje no está disponible para reservas.', 409);
  }

  if (viaje.dias < DIAS_MIN_ANTICIPACION || viaje.dias > DIAS_MAX_ANTICIPACION) {
    throw new ErrorReserva(
      `Solo se puede reservar con ${DIAS_MIN_ANTICIPACION} a ${DIAS_MAX_ANTICIPACION} días de anticipación.`,
      409
    );
  }

  if (!viaje.activa) {
    throw new ErrorReserva('El viaje no tiene una van activa asignada.', 409);
  }

  if (asiento > Number(viaje.capacidad)) {
    throw new ErrorReserva('El asiento supera la capacidad de la van.');
  }

  return viaje;
}

export function crearServicioReservas(dependencias?: {
  baseDatos?: Pick<Pool, 'connect'>;
  enviarCorreo?: typeof servicioCorreo.enviarCorreo;
}) {
  const baseDatos = dependencias?.baseDatos ?? pool;
  const enviarCorreo = dependencias?.enviarCorreo ?? servicioCorreo.enviarCorreo;

  return async function crearReservas(
    usuario: {
      id: number;
      nombreCompleto: string;
      correo: string;
    },
    solicitudes: SolicitudReserva[]
  ): Promise<ResultadoReserva> {
    if (!Array.isArray(solicitudes) || solicitudes.length === 0) {
      throw new ErrorReserva('Debes seleccionar al menos un viaje.');
    }

    if (solicitudes.length > 2) {
      throw new ErrorReserva('No puedes reservar más de dos trayectos.');
    }

    if (solicitudes.some((s) => !s || typeof s !== 'object')) {
      throw new ErrorReserva('Cada reserva debe indicar el viaje y el asiento.');
    }

    const viajesSolicitados = solicitudes.map((s) => s.viajeId);

    if (new Set(viajesSolicitados).size !== viajesSolicitados.length) {
      throw new ErrorReserva('No puedes repetir un mismo viaje.');
    }

    const cliente = await baseDatos.connect();
    let grupoId = '';

    try {
      await cliente.query('BEGIN');

      grupoId = (
        await cliente.query('SELECT gen_random_uuid() AS id')
      ).rows[0].id;

      // Se bloquean los viajes en orden de id: dos reservas cruzadas no se esperan entre sí.
      const viajes = new Map<SolicitudReserva, DatosViaje>();
      for (const solicitud of [...solicitudes].sort((a, b) => a.viajeId - b.viajeId)) {
        viajes.set(solicitud, await validarViaje(cliente, solicitud.viajeId, solicitud.asiento));
      }

      if (solicitudes.length === 2) {
        const [primero, segundo] = solicitudes.map((s) => viajes.get(s)!);
        if (primero.fecha !== segundo.fecha || primero.trayecto === segundo.trayecto) {
          throw new ErrorReserva('Una reserva de ida y vuelta debe tener la ida y la vuelta del mismo día.');
        }
      }

      const reservas: ResultadoReserva['reservas'] = [];

      for (const solicitud of solicitudes) {
        const viaje = viajes.get(solicitud)!;

        const resultado = await cliente.query(
          `INSERT INTO reservas (
             grupo_id,
             usuario_id,
             viaje_id,
             asiento
           )
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [grupoId, usuario.id, solicitud.viajeId, solicitud.asiento]
        );

        reservas.push({
          id: resultado.rows[0].id,
          viajeId: viaje.id,
          asiento: solicitud.asiento,
          fecha: viaje.fecha,
          hora: viaje.hora,
          trayecto: viaje.trayecto,
          origen: viaje.origen,
          destino: viaje.destino,
        });
      }

      await cliente.query('COMMIT');

      try {
        const detalles = reservas.flatMap((reserva) => [
          {
            etiqueta: `Viaje ${reserva.trayecto}`,
            valor: `${reserva.fecha} - ${reserva.hora}`,
          },
          {
            etiqueta: 'Ruta',
            valor: `${reserva.origen} → ${reserva.destino}`,
          },
          {
            etiqueta: 'Asiento',
            valor: String(reserva.asiento),
          },
        ]);

        const datos = {
          titulo: 'Reserva confirmada',
          mensaje: `Hola ${usuario.nombreCompleto}, tus reservas se registraron correctamente.`,
          detalles,
        };

        await enviarCorreo({
          para: usuario.correo,
          asunto: 'Confirmación de reserva - Vans UNAB',
          texto: crearPlantillaTexto(datos),
          html: crearPlantillaHTML(datos),
        });
      } catch (error) {
        console.error(
          '[Reservas] La reserva fue guardada, pero no se pudo enviar el correo:',
          error
        );
      }

      return { grupoId, reservas };
    } catch (error) {
      await cliente.query('ROLLBACK');

      // Los índices únicos de 005_reservas.sql deciden si dos personas piden lo mismo a la vez.
      const { code, constraint } = error as { code?: string; constraint?: string };
      if (code === '23505') {
        const mensajes: Record<string, string> = {
          reservas_asiento_activo_unique: 'El asiento ya fue reservado por otra persona. Elige otro.',
          reservas_usuario_viaje_activo_unique: 'Ya tienes una reserva en este viaje.',
        };
        throw new ErrorReserva(
          mensajes[constraint ?? ''] ?? 'El asiento ya está ocupado o ya tienes una reserva para este viaje.',
          409
        );
      }

      throw error;
    } finally {
      cliente.release();
    }
  };
}

export const crearReservas = crearServicioReservas();
