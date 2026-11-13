import type { ConductorBd, UsuarioBd, ViajeBd } from '../../api'
import { adminInicial, choferesIniciales, pasajerosIniciales, reservasIniciales, vansIniciales, viajesIniciales } from '../data/mock'
import { CAPACIDAD_VAN, type Admin, type Chofer, type EstadoViaje, type Notificacion, type Pasajero, type Reserva, type Rol, type Van, type Viaje } from '../types'
import { isoLocal, normalizarTelefono, todayISO } from '../utils/format'
import { sincronizar, validarCambioAsientos, validarSolicitud, type CambioAsiento } from './reservas'
import { aplicarViajesBd, type AlcanceViajes } from './viajesBd'

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
  | { type: 'chofer/desdeBd'; conductores: ConductorBd[] }
  | { type: 'pasajero/desdeBd'; usuarios: UsuarioBd[] }
  | { type: 'pasajero/aprobar'; id: string; rol: Rol }
  | { type: 'pasajero/rechazar'; id: string }
  | { type: 'pasajero/eliminar'; id: string }
  | { type: 'pasajero/patch'; id: string; patch: Partial<Pasajero> }
  | { type: 'viaje/add'; viajes: Viaje[] }
  /** Viajes que devolvió el backend (S3-VIA-03 / S3-CON-02): la base manda sobre lo guardado en este navegador. */
  | { type: 'viaje/desdeBd'; viajes: ViajeBd[]; alcance: AlcanceViajes }
  | { type: 'viaje/estado'; id: string; estado: EstadoViaje; notificacion?: Notificacion }
  | { type: 'viaje/van'; id: string; vanId: string }
  | { type: 'reserva/crear'; reservas: Reserva[] }
  | { type: 'reserva/cancelar'; ids: string[] }
  | { type: 'reserva/asientos'; pasajeroId: string; grupoId: string; cambios: CambioAsiento[] }
  | { type: 'notif/leer'; id: string }
  | { type: 'notif/leerTodas' }
  | { type: 'admin/update'; patch: Partial<Admin> }
  /** Otra pestaña del mismo navegador guardó cambios: se adopta su estado. */
  | { type: 'estado/otraPestana'; state: State }

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
    case 'chofer/desdeBd': {
      // Los conductores aprobados en PostgreSQL pasan a la lista de choferes (se reconocen por id o por correo).
      let choferes = s.choferes
      let vans = s.vans
      for (const c of a.conductores) {
        const actual =
          choferes.find((ch) => ch.idBd === c.id) ?? choferes.find((ch) => ch.correo.toLowerCase() === c.correo.toLowerCase())
        const activo = c.activo && c.estado === 'aprobada'
        const datos: Chofer = {
          id: actual?.id ?? `cbd${c.id}`,
          idBd: c.id,
          nombre: c.nombreCompleto,
          correo: c.correo.toLowerCase(),
          telefono: normalizarTelefono(c.telefono) ?? c.telefono,
          rut: c.rut ?? actual?.rut ?? '',
          licenciaHasta: c.licenciaHasta ?? actual?.licenciaHasta ?? '',
          activo,
        }
        choferes = actual ? choferes.map((ch) => (ch === actual ? datos : ch)) : [...choferes, datos]
        if (!activo) vans = liberarChofer(vans, datos.id)
      }
      // el celular es de la cuenta: también se actualiza en su perfil
      const celulares = new Map(a.conductores.map((c) => [c.id, normalizarTelefono(c.telefono) ?? c.telefono]))
      const pasajeros = s.pasajeros.map((p) =>
        p.idBd !== undefined && celulares.has(p.idBd) ? { ...p, celular: celulares.get(p.idBd)! } : p)
      return { ...s, choferes, vans, pasajeros }
    }
    case 'pasajero/desdeBd': {
      // Las cuentas viven en PostgreSQL (BD-17/18). Se copian aquí para que el resto de la app
      // (reservas, viajes, panel) las use igual que a los pasajeros de ejemplo.
      let pasajeros = s.pasajeros
      for (const u of a.usuarios) {
        if (u.rol === 'administrador') continue
        const actual = pasajeroDeCuenta(pasajeros, u)
        // Una solicitud rechazada deja de aparecer.
        if (u.estado === 'rechazada') {
          pasajeros = pasajeros.filter((p) => p !== actual)
          continue
        }
        const datos = {
          idBd: u.id,
          nombre: u.nombreCompleto,
          email: u.correo,
          sede: u.sede ?? '',
          celular: normalizarTelefono(u.telefono) ?? u.telefono,
          rol: u.rol ?? undefined,
          aprobado: u.estado !== 'pendiente',
          habilitado: u.estado !== 'desactivada',
          ultimoIngreso: isoLocal(u.ultimoIngresoEn ?? u.creadoEn),
        }
        pasajeros = actual
          ? pasajeros.map((p) => (p === actual ? { ...p, ...datos } : p))
          : [...pasajeros, { id: idLocalDe(pasajeros, u), puedeAbrirViajes: false, ...datos }]
      }
      // si la cuenta es de un chofer, su celular también cambia en Choferes
      const choferes = s.choferes.map((ch) => {
        const u = a.usuarios.find((x) => x.id === ch.idBd || x.correo.toLowerCase() === ch.correo.toLowerCase())
        return u && u.rol === 'conductor' ? { ...ch, telefono: normalizarTelefono(u.telefono) ?? u.telefono } : ch
      })
      return { ...s, pasajeros, choferes }
    }
    case 'pasajero/aprobar':
      // La aprobación se hace una sola vez: solo afecta a solicitudes que siguen por aprobar.
      return {
        ...s,
        pasajeros: s.pasajeros.map((p) => (p.id === a.id && !p.aprobado ? { ...p, aprobado: true, rol: a.rol } : p)),
      }
    case 'pasajero/rechazar':
      // Rechazar elimina la solicitud (no existe cuenta aún). Una cuenta ya aprobada no se puede rechazar.
      return { ...s, pasajeros: s.pasajeros.filter((p) => p.id !== a.id || p.aprobado) }
    case 'pasajero/eliminar':
      // Borra la cuenta y todas sus reservas (libera los asientos) y recalcula los cupos de los viajes.
      return sincronizar({
        ...s,
        pasajeros: s.pasajeros.filter((p) => p.id !== a.id),
        reservas: s.reservas.filter((r) => r.pasajeroId !== a.id),
      })
    case 'pasajero/patch':
      return { ...s, pasajeros: s.pasajeros.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) }
    case 'viaje/add':
      return { ...s, viajes: [...s.viajes, ...a.viajes] }
    case 'viaje/desdeBd':
      return aplicarViajesBd(s, a.viajes, a.alcance)
      case 'viaje/estado': {
          const viaje = s.viajes.find((v) => v.id === a.id)
          if (!viaje) return s
          if (a.estado === 'en-curso' && viaje.estado !== 'pendiente') return s
          // una van hace un viaje a la vez: no se inicia otro mientras haya uno en curso
          if (a.estado === 'en-curso' && viaje.vanId && s.viajes.some((v) => v.id !== viaje.id && v.vanId === viaje.vanId && v.estado === 'en-curso')) return s

          return sincronizar({
              ...s,
              viajes: s.viajes.map((v) => (v.id === a.id ? { ...v, estado: a.estado } : v)),
              reservas: cerrarReservas(s.reservas, a.id, a.estado),
              notificaciones: a.notificacion ? [a.notificacion, ...s.notificaciones] : s.notificaciones,
          })
      }
    case 'reserva/crear': {
      // Defensa: el contexto ya validó, pero el reducer nunca aplica una reserva que choque con otra.
      const primera = a.reservas[0]
      if (!primera) return s
      const items = a.reservas.map((r) => ({ viajeId: r.viajeId, trayecto: r.trayecto, asiento: r.asiento }))
      if (validarSolicitud(s, primera.pasajeroId, items).length > 0) return s
      return sincronizar({ ...s, reservas: [...s.reservas, ...a.reservas] })
    }
    case 'reserva/cancelar': {
      // Una reserva cancelada libera su asiento (ver estaActiva) y sincroniza los cupos del viaje.
      const ids = new Set(a.ids)
      return sincronizar({
        ...s,
        reservas: s.reservas.map((r) => (ids.has(r.id) && r.estado === 'pendiente' ? { ...r, estado: 'cancelada' as const } : r)),
      })
    }
    case 'reserva/asientos': {
      if (validarCambioAsientos(s, a.pasajeroId, a.grupoId, a.cambios).length > 0) return s
      const nuevo = new Map(a.cambios.map((c) => [c.id, c.asiento]))
      return sincronizar({ ...s, reservas: s.reservas.map((r) => (nuevo.has(r.id) ? { ...r, asiento: nuevo.get(r.id)! } : r)) })
    }
    case 'notif/leer':
      return { ...s, notificaciones: s.notificaciones.map((n) => (n.id === a.id ? { ...n, leida: true } : n)) }
    case 'notif/leerTodas':
      return { ...s, notificaciones: s.notificaciones.map((n) => ({ ...n, leida: true })) }
    case 'viaje/van':
      return { ...s, viajes: s.viajes.map((v) => (v.id === a.id ? { ...v, vanId: a.vanId } : v)) }
    case 'admin/update':
      return { ...s, admin: { ...s.admin, ...a.patch } }
    case 'estado/otraPestana':
      return a.state
  }
}

/** Pasajero local que corresponde a una cuenta de la base: por su id en la base o, si no, por correo. */
export const pasajeroDeCuenta = (pasajeros: Pasajero[], u: UsuarioBd) =>
  pasajeros.find((p) => p.idBd === u.id) ?? pasajeros.find((p) => p.email.toLowerCase() === u.correo.toLowerCase())

/** id local de una cuenta de la base: el del pasajero que ya le corresponde o uno nuevo, `bd<id>`. */
export const idLocalDe = (pasajeros: Pasajero[], u: UsuarioBd) => pasajeroDeCuenta(pasajeros, u)?.id ?? `bd${u.id}`

/* ---------- Persistencia local (vans, viajes y reservas siguen siendo de ejemplo) ---------- */

/** Clave del estado en localStorage; AdminProvider la escucha para sincronizar pestañas. */
export const KEY = 'unab-admin-v3'

/** Estado guardado (por esta u otra pestaña), o null si no hay uno válido. */
export const leerEstadoGuardado = (): State | null => leerGuardado()

export function cargarEstado(): State {
  return limpiezaUnica(leerGuardado() ?? estadoInicial())
}

function leerGuardado(): State | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<State>
      if (Array.isArray(p.vans) && Array.isArray(p.choferes) && Array.isArray(p.pasajeros) && Array.isArray(p.viajes) && Array.isArray(p.reservas) && p.admin) {
        // la capacidad es fija (Hyundai Staria, 9 asientos): corrige lo guardado con la capacidad antigua
        const vans = p.vans.map((v) => ({ ...v, asientos: CAPACIDAD_VAN }))
        return sincronizar({ ...p, vans, notificaciones: p.notificaciones ?? [] } as State)
      }
    }
  } catch {
    /* sin almacenamiento o JSON corrupto: se usa el estado inicial */
  }
  return null
}

/** Quita los viajes de días anteriores a `hoy`, con sus reservas y avisos. */
export function sinViajesPasados(s: State, hoy: string): State {
  const pasados = new Set(s.viajes.filter((v) => v.fecha < hoy).map((v) => v.id))
  if (pasados.size === 0) return s
  return sincronizar({
    ...s,
    viajes: s.viajes.filter((v) => !pasados.has(v.id)),
    reservas: s.reservas.filter((r) => !pasados.has(r.viajeId)),
    notificaciones: s.notificaciones.filter((n) => !pasados.has(n.viajeId)),
  })
}

// La primera vez que la app abre en un navegador se borran los viajes de ejemplo de fechas pasadas.
// Las pruebas no la usan: necesitan esos viajes.
const LIMPIEZA = 'unab-limpieza-viajes-v1'

function limpiezaUnica(s: State): State {
  if (import.meta.env.MODE === 'test') return s
  try {
    if (localStorage.getItem(LIMPIEZA)) return s
    localStorage.setItem(LIMPIEZA, todayISO())
  } catch {
    return s
  }
  return sinViajesPasados(s, todayISO())
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
