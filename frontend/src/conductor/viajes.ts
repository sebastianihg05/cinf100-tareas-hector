import type { State } from '../admin/store/adminStore'
import { estaActiva } from '../admin/store/reservas'
import type { Chofer, Van, Viaje } from '../admin/types'
import { todayISO } from '../admin/utils/format'

/** Lo que el conductor necesita saber de su asignación: quién es, qué van maneja y qué viajes tiene. */
export type Asignacion = {
  /** registro de chofer que el administrador creó con el correo del conductor; `undefined` si no existe */
  chofer?: Chofer
  /** van que tiene asignada; `undefined` si no maneja ninguna */
  van?: Van
  /** viajes asignados a esa van, de cualquier estado, ordenados por fecha y hora */
  viajes: Viaje[]
}

/** Viajes que el conductor todavía debe realizar: en curso, o pendientes desde hoy en adelante. */
export const esProximo = (v: Viaje) => v.estado === 'en-curso' || (v.estado === 'pendiente' && v.fecha >= todayISO())

/** Viajes ya cerrados: completados o cancelados. */
const esCerrado = (v: Viaje) => v.estado === 'completado' || v.estado === 'cancelado'

/** Compara fecha y hora de dos viajes (yyyy-mm-dd + hh:mm). */
const porFechaHora = (a: Viaje, b: Viaje) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)

/**
 * Viajes asignados a un conductor. La cadena es: cuenta (correo) -> chofer -> van -> viajes.
 * El administrador es quien relaciona al chofer con su van (Vans) y la van con cada viaje (Viajes).
 */
export function asignacionDe(datos: Pick<State, 'choferes' | 'vans' | 'viajes'>, correo: string): Asignacion {
  const chofer = datos.choferes.find((c) => c.correo.toLowerCase() === correo.trim().toLowerCase())
  const van = chofer && chofer.activo ? datos.vans.find((v) => v.activa && v.choferId === chofer.id) : undefined
  const viajes = van ? datos.viajes.filter((v) => v.vanId === van.id).sort(porFechaHora) : []
  return { chofer, van, viajes }
}

/** Separa los viajes en próximos (el más cercano primero) e historial (el más reciente primero). */
export function separarViajes(viajes: Viaje[]): { proximos: Viaje[]; historial: Viaje[] } {
  return {
    proximos: viajes.filter(esProximo).sort(porFechaHora),
    historial: viajes.filter(esCerrado).sort((a, b) => porFechaHora(b, a)),
  }
}

/** Viaje ya realizado: solo los completados forman el historial del conductor. */
export const esFinalizado = (v: Viaje) => v.estado === 'completado'

/** Viajes finalizados, el más reciente primero. */
export const viajesFinalizados = (viajes: Viaje[]): Viaje[] =>
  viajes.filter(esFinalizado).sort((a, b) => porFechaHora(b, a))

/**
 * Un viaje por su id, pero solo si pertenece a la van del conductor.
 * Evita que alguien abra el detalle de un viaje ajeno escribiendo su id en la dirección.
 */
export const viajeAsignado = (asignacion: Asignacion, viajeId: string | undefined): Viaje | undefined =>
  asignacion.viajes.find((v) => v.id === viajeId)

/**
 * Trayectos que la van del conductor hace ese mismo día (normalmente la ida y la vuelta),
 * ordenados por hora. Incluye al propio viaje.
 */
export const trayectosDelDia = (asignacion: Asignacion, viaje: Viaje): Viaje[] =>
  asignacion.viajes.filter((v) => v.fecha === viaje.fecha).sort(porFechaHora)

/** Un pasajero con reserva en el viaje, tal como lo ve el conductor. */
export type PasajeroDelViaje = { reservaId: string; asiento: number; nombre: string; celular: string }

/** Pasajeros con reserva vigente (no cancelada) en un viaje, ordenados por número de asiento. */
export function pasajerosDelViaje(datos: Pick<State, 'reservas' | 'pasajeros'>, viajeId: string): PasajeroDelViaje[] {
  return datos.reservas
    .filter((r) => r.viajeId === viajeId && estaActiva(r))
    .sort((a, b) => a.asiento - b.asiento)
    .map((r) => {
      const pasajero = datos.pasajeros.find((p) => p.id === r.pasajeroId)
      return {
        reservaId: r.id,
        asiento: r.asiento,
        nombre: pasajero?.nombre ?? 'Pasajero no encontrado',
        celular: pasajero?.celular ?? '',
      }
    })
}

/** Viaje de la van que está en curso; mientras exista, no se puede iniciar otro. */
export const viajeEnCurso = (asignacion: Asignacion): Viaje | undefined =>
  asignacion.viajes.find((v) => v.estado === 'en-curso')
