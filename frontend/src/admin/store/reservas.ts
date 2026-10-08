import type { EstadoReserva, Pasajero, Reserva, Trayecto, Van, Viaje } from '../types'
import { ahoraISO, todayISO } from '../utils/format'

/**
 * Lógica pura de reservas por asiento. Se comparte entre el reducer del administrador y la
 * app del pasajero, de modo que ambos lados vean siempre los mismos datos.
 */

/** Subconjunto del estado global que necesitan estas funciones. */
export type Datos = {
  vans: Van[]
  viajes: Viaje[]
  pasajeros: Pasajero[]
  reservas: Reserva[]
}

export type SolicitudReserva = { viajeId: string; trayecto: Trayecto; asiento: number }

export type CodigoConflicto =
  | 'pasajero-no-habilitado'
  | 'viaje-no-disponible'
  | 'asiento-invalido'
  | 'asiento-ocupado'
  | 'reserva-duplicada'

export type Conflicto = { codigo: CodigoConflicto; mensaje: string; trayecto?: Trayecto }

export type ResultadoReserva =
  | { ok: true; grupoId: string; reservas: Reserva[] }
  | { ok: false; tipo: 'conflicto'; error: string; conflictos: Conflicto[] }
  | { ok: false; tipo: 'almacenamiento'; error: string }

export type TrayectoReserva = { reserva: Reserva; viaje?: Viaje }

/** Una reserva del pasajero: uno o dos trayectos (ida / vuelta) que comparten `grupoId`. */
export type GrupoReserva = {
  grupoId: string
  /** fecha del viaje (yyyy-mm-dd); vacía si el viaje ya no existe */
  fecha: string
  hora: string
  estado: EstadoReserva
  trayectos: TrayectoReserva[]
}

/** Una reserva cancelada libera el asiento. */
export const estaActiva = (r: Reserva) => r.estado !== 'cancelada'

/** Capacidad de pasajeros del viaje; `undefined` mientras no tiene van asignada. */
export const capacidadDeViaje = (datos: Pick<Datos, 'vans'>, viaje: Viaje): number | undefined =>
  datos.vans.find((v) => v.id === viaje.vanId)?.asientos

/** Números de asiento tomados en el viaje, de menor a mayor. */
export const asientosOcupados = (reservas: Reserva[], viajeId: string): number[] =>
  reservas.filter((r) => r.viajeId === viajeId && estaActiva(r)).map((r) => r.asiento).sort((a, b) => a - b)

/** El viaje ya salió (fecha pasada, o de hoy con la hora de salida cumplida). */
export function yaSalio(viaje: Pick<Viaje, 'fecha' | 'hora'>): boolean {
  const hoy = todayISO()
  return viaje.fecha < hoy || (viaje.fecha === hoy && viaje.hora <= ahoraISO().slice(11, 16))
}

/** Valida una solicitud de 1 o 2 asientos. Devuelve la lista de conflictos (vacía si es válida). */
export function validarSolicitud(datos: Datos, pasajeroId: string, items: SolicitudReserva[]): Conflicto[] {
  const conflictos: Conflicto[] = []
  const pasajero = datos.pasajeros.find((p) => p.id === pasajeroId)
  if (!pasajero || !pasajero.aprobado || !pasajero.habilitado) {
    conflictos.push({ codigo: 'pasajero-no-habilitado', mensaje: 'Tu cuenta no está habilitada para reservar.' })
  }
  if (items.length === 0) {
    conflictos.push({ codigo: 'viaje-no-disponible', mensaje: 'No hay viajes seleccionados para reservar.' })
  }

  for (const it of items) {
    const viaje = datos.viajes.find((v) => v.id === it.viajeId)
    const capacidad = viaje ? capacidadDeViaje(datos, viaje) : undefined
    if (!viaje || viaje.trayecto !== it.trayecto || viaje.estado !== 'pendiente' || capacidad === undefined || yaSalio(viaje)) {
      conflictos.push({
        codigo: 'viaje-no-disponible', trayecto: it.trayecto,
        mensaje: `El viaje de ${it.trayecto} ya no está disponible.`,
      })
      continue
    }
    if (!Number.isInteger(it.asiento) || it.asiento < 1 || it.asiento > capacidad) {
      conflictos.push({
        codigo: 'asiento-invalido', trayecto: it.trayecto,
        mensaje: `El asiento ${it.asiento} no existe en el viaje de ${it.trayecto}.`,
      })
      continue
    }
    if (asientosOcupados(datos.reservas, viaje.id).includes(it.asiento)) {
      conflictos.push({
        codigo: 'asiento-ocupado', trayecto: it.trayecto,
        mensaje: `El asiento ${it.asiento} del viaje de ${it.trayecto} acaba de ser reservado. Elige otro.`,
      })
      continue
    }
    if (datos.reservas.some((r) => r.viajeId === viaje.id && r.pasajeroId === pasajeroId && estaActiva(r))) {
      conflictos.push({
        codigo: 'reserva-duplicada', trayecto: it.trayecto,
        mensaje: `Ya tienes una reserva en el viaje de ${it.trayecto} de esa fecha.`,
      })
    }
  }
  return conflictos
}

const clave = (v: Pick<Viaje, 'fecha' | 'hora'>) => `${v.fecha} ${v.hora}`

const mismaReserva = (a: Pasajero['reserva'], b: Pasajero['reserva']) =>
  a?.fecha === b?.fecha && a?.trayecto === b?.trayecto && a?.asiento === b?.asiento

/**
 * Mantiene coherentes los datos derivados que usa el administrador:
 * - `Viaje.reservados`: asientos no cancelados del viaje.
 * - `Pasajero.reserva`: su próximo viaje pendiente (solo si el pasajero tiene reservas registradas).
 */
export function sincronizar<T extends Datos>(s: T): T {
  const cuenta = new Map<string, number>()
  for (const r of s.reservas) if (estaActiva(r)) cuenta.set(r.viajeId, (cuenta.get(r.viajeId) ?? 0) + 1)

  const viajes = s.viajes.map((v) => {
    const n = cuenta.get(v.id) ?? 0
    return v.reservados === n ? v : { ...v, reservados: n }
  })
  const porId = new Map(viajes.map((v) => [v.id, v]))

  const pasajeros = s.pasajeros.map((p) => {
    const mias = s.reservas.filter((r) => r.pasajeroId === p.id)
    if (mias.length === 0) return p
    const proxima = mias
      .flatMap((r) => {
        const v = porId.get(r.viajeId)
        return r.estado === 'pendiente' && v && v.estado === 'pendiente' ? [{ r, v }] : []
      })
      .sort((a, b) => clave(a.v).localeCompare(clave(b.v)))[0]
    const reserva = proxima ? { fecha: proxima.v.fecha, trayecto: proxima.r.trayecto, asiento: proxima.r.asiento } : undefined
    return mismaReserva(p.reserva, reserva) ? p : { ...p, reserva }
  })

  return { ...s, viajes, pasajeros }
}

/** Estado global de una reserva: pendiente si queda algo por viajar; si no, completada o cancelada. */
function estadoDelGrupo(trayectos: TrayectoReserva[]): EstadoReserva {
  if (trayectos.some((t) => t.reserva.estado === 'pendiente')) return 'pendiente'
  if (trayectos.some((t) => t.reserva.estado === 'completada')) return 'completada'
  return 'cancelada'
}

/** Agrupa las reservas del pasajero en "Próximas" (por viajar) e "Historial". */
export function agruparReservas(
  datos: Pick<Datos, 'viajes' | 'reservas'>,
  pasajeroId: string,
  hoy: string = todayISO(),
): { proximas: GrupoReserva[]; historial: GrupoReserva[] } {
  const porGrupo = new Map<string, TrayectoReserva[]>()
  for (const r of datos.reservas) {
    if (r.pasajeroId !== pasajeroId) continue
    const lista = porGrupo.get(r.grupoId) ?? []
    lista.push({ reserva: r, viaje: datos.viajes.find((v) => v.id === r.viajeId) })
    porGrupo.set(r.grupoId, lista)
  }

  const grupos: GrupoReserva[] = [...porGrupo.entries()].map(([grupoId, lista]) => {
    const trayectos = [...lista].sort((a, b) => (a.reserva.trayecto === b.reserva.trayecto ? 0 : a.reserva.trayecto === 'Ida' ? -1 : 1))
    const primero = trayectos.find((t) => t.viaje)?.viaje
    return { grupoId, fecha: primero?.fecha ?? '', hora: primero?.hora ?? '', estado: estadoDelGrupo(trayectos), trayectos }
  })

  const proximas = grupos
    .filter((g) => g.estado === 'pendiente' && g.fecha !== '' && g.fecha >= hoy)
    .sort((a, b) => clave(a).localeCompare(clave(b)))
  const historial = grupos
    .filter((g) => !proximas.includes(g))
    .sort((a, b) => clave(b).localeCompare(clave(a)))
  return { proximas, historial }
}

/**
 * Reservas de un grupo que el pasajero todavía puede cancelar: las suyas, pendientes, de un viaje que sigue
 * pendiente y que aún no sale. Una reserva de ida y vuelta se cancela completa (todos sus trayectos pendientes).
 */
export function cancelables(datos: Pick<Datos, 'viajes' | 'reservas'>, pasajeroId: string, grupoId: string): Reserva[] {
  return datos.reservas.filter((r) => {
    if (r.pasajeroId !== pasajeroId || r.grupoId !== grupoId || r.estado !== 'pendiente') return false
    const viaje = datos.viajes.find((v) => v.id === r.viajeId)
    return viaje !== undefined && viaje.estado === 'pendiente' && !yaSalio(viaje)
  })
}
