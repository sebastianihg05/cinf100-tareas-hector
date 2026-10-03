import { adminInicial, choferesIniciales, pasajerosIniciales, vansIniciales, viajesIniciales } from '../data/mock'
import type { Admin, Chofer, EstadoViaje, Notificacion, Pasajero, Van, Viaje } from '../types'

export type State = {
  vans: Van[]
  choferes: Chofer[]
  pasajeros: Pasajero[]
  viajes: Viaje[]
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
  | { type: 'notif/leer'; id: string }
  | { type: 'notif/leerTodas' }
  | { type: 'admin/update'; patch: Partial<Admin> }

export const estadoInicial = (): State => ({
  vans: vansIniciales,
  choferes: choferesIniciales,
  pasajeros: pasajerosIniciales,
  viajes: viajesIniciales,
  notificaciones: [],
  admin: adminInicial,
})

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
      return {
        ...s,
        viajes: s.viajes.map((v) => (v.id === a.id ? { ...v, estado: a.estado } : v)),
        notificaciones: a.notificacion ? [a.notificacion, ...s.notificaciones] : s.notificaciones,
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

const KEY = 'unab-admin-v2'

export function cargarEstado(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<State>
      if (Array.isArray(p.vans) && Array.isArray(p.choferes) && Array.isArray(p.pasajeros) && Array.isArray(p.viajes) && p.admin) {
        return { ...p, notificaciones: p.notificaciones ?? [] } as State
      }
    }
  } catch {
    /* sin almacenamiento o JSON corrupto: se usa el estado inicial */
  }
  return estadoInicial()
}

export function guardarEstado(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignorar */
  }
}

export const nuevoId = (prefijo: string) => `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
