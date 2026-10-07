import { adminInicial, choferesIniciales, pasajerosIniciales, reservasIniciales, vansIniciales, viajesIniciales } from '../data/mock'
import type { Admin, Chofer, EstadoViaje, Notificacion, Pasajero, Reserva, Van, Viaje } from '../types'
import { sincronizar, validarSolicitud } from './reservas'

export type State = {
  vans: Van[]
  choferes: Chofer[]
  pasajeros: Pasajero[]
  viajes: Viaje[]
  /** asientos reservados por los pasajeros (compartidos con la app del pasajero) */
  reservas: Reserva[]
  notificaciones: Notificacion[]
  admin: Admin
}

export type Action =
  | { type: 'van/save'; van: Van }
  | { type: 'van/toggle'; id: string }
  | { type: 'chofer/save'; chofer: Chofer }
  | { type: 'chofer/toggle'; id: string }
  | { type: 'pasajero/patch'; id: string; patch: Partial<Pasajero> }
  | { type: 'viaje/add'; viajes: Viaje[] }
  | { type: 'viaje/estado'; id: string; estado: EstadoViaje; notificacion?: Notificacion }
  | { type: 'viaje/van'; id: string; vanId: string }
  | { type: 'reserva/crear'; reservas: Reserva[] }
  | { type: 'notif/leer'; id: string }
  | { type: 'notif/leerTodas' }
  | { type: 'admin/update'; patch: Partial<Admin> }

export const estadoInicial = (): State =>
  sincronizar({
    vans: vansIniciales,
    choferes: choferesIniciales,
    pasajeros: pasajerosIniciales,
    viajes: viajesIniciales,
    reservas: reservasIniciales,
    notificaciones: [],
    admin: adminInicial,
  })

/** Al cancelar o completar un viaje, sus reservas pendientes siguen la misma suerte. */
const cerrarReservas = (reservas: Reserva[], viajeId: string, estado: EstadoViaje): Reserva[] => {
  if (estado !== 'cancelado' && estado !== 'completado') return reservas
  const nuevo = estado === 'cancelado' ? 'cancelada' : 'completada'
  return reservas.map((r) => (r.viajeId === viajeId && r.estado === 'pendiente' ? { ...r, estado: nuevo } : r))
}

const liberarChofer = (vans: Van[], choferId: string) =>
  vans.map((v) => (v.choferId === choferId ? { ...v, choferId: null } : v))

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'van/save': {
      const existe = s.vans.some((v) => v.id === a.van.id)
      let vans = existe ? s.vans.map((v) => (v.id === a.van.id ? a.van : v)) : [...s.vans, a.van]
      // un chofer maneja una sola van
      if (a.van.choferId) {
        vans = vans.map((v) => (v.id !== a.van.id && v.choferId === a.van.choferId ? { ...v, choferId: null } : v))
      }
      return { ...s, vans }
    }
    case 'van/toggle':
      return {
        ...s,
        vans: s.vans.map((v) => (v.id === a.id ? { ...v, activa: !v.activa, choferId: v.activa ? null : v.choferId } : v)),
      }
    case 'chofer/save': {
      const existe = s.choferes.some((c) => c.id === a.chofer.id)
      return {
        ...s,
        choferes: existe ? s.choferes.map((c) => (c.id === a.chofer.id ? a.chofer : c)) : [...s.choferes, a.chofer],
      }
    }
    case 'chofer/toggle': {
      const actual = s.choferes.find((c) => c.id === a.id)
      if (!actual) return s
      return {
        ...s,
        choferes: s.choferes.map((c) => (c.id === a.id ? { ...c, activo: !c.activo } : c)),
        vans: actual.activo ? liberarChofer(s.vans, a.id) : s.vans,
      }
    }
    case 'pasajero/patch':
      return { ...s, pasajeros: s.pasajeros.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) }
    case 'viaje/add':
      return { ...s, viajes: [...s.viajes, ...a.viajes] }
    case 'viaje/estado':
      return sincronizar({
        ...s,
        viajes: s.viajes.map((v) => (v.id === a.id ? { ...v, estado: a.estado } : v)),
        reservas: cerrarReservas(s.reservas, a.id, a.estado),
        notificaciones: a.notificacion ? [a.notificacion, ...s.notificaciones] : s.notificaciones,
      })
    case 'reserva/crear': {
      // Defensa: el contexto ya validó, pero el reducer nunca aplica una reserva que choque con otra.
      const primera = a.reservas[0]
      if (!primera) return s
      const items = a.reservas.map((r) => ({ viajeId: r.viajeId, trayecto: r.trayecto, asiento: r.asiento }))
      if (validarSolicitud(s, primera.pasajeroId, items).length > 0) return s
      return sincronizar({ ...s, reservas: [...s.reservas, ...a.reservas] })
    }
    case 'notif/leer':
      return { ...s, notificaciones: s.notificaciones.map((n) => (n.id === a.id ? { ...n, leida: true } : n)) }
    case 'notif/leerTodas':
      return { ...s, notificaciones: s.notificaciones.map((n) => ({ ...n, leida: true })) }
    case 'viaje/van':
      return { ...s, viajes: s.viajes.map((v) => (v.id === a.id ? { ...v, vanId: a.vanId } : v)) }
    case 'admin/update':
      return { ...s, admin: { ...s.admin, ...a.patch } }
  }
}

/* ---------- Persistencia local (hasta que exista el backend) ---------- */

const KEY = 'unab-admin-v3'

export function cargarEstado(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<State>
      if (Array.isArray(p.vans) && Array.isArray(p.choferes) && Array.isArray(p.pasajeros) && Array.isArray(p.viajes) && Array.isArray(p.reservas) && p.admin) {
        return sincronizar({ ...p, notificaciones: p.notificaciones ?? [] } as State)
      }
    }
  } catch {
    /* sin almacenamiento o JSON corrupto: se usa el estado inicial */
  }
  return estadoInicial()
}

/** Devuelve `false` si el navegador no pudo guardar (sin espacio, modo privado, etc.). */
export function guardarEstado(s: State): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}

export const nuevoId = (prefijo: string) => `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
