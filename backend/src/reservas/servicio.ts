
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
       v.fecha,
       v.hora,
       v.trayecto,
       v.origen,
       v.destino,
       v.estado,
       COALESCE(va.capacidad, 0) AS capacidad,
       COALESCE(va.activa, FALSE) AS activa
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

      const reservas: ResultadoReserva['reservas'] = [];

      for (const solicitud of solicitudes) {
        const viaje = await validarViaje(
          cliente,
          solicitud.viajeId,
          solicitud.asiento
        );

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

      if ((error as { code?: string }).code === '23505') {
        throw new ErrorReserva(
          'El asiento ya está ocupado o ya tienes una reserva para este viaje.',
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
