import type { EstadoReserva, EstadoViaje, Rol, Trayecto } from './admin/types'
import { leerSesion } from './login/sesion'

export type UsuarioBd = {
  id: number
  nombreCompleto: string
  correo: string
  telefono: string
  sede: string | null
  rol: Rol | 'administrador' | null
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'desactivada'
  creadoEn: string
  ultimoIngresoEn: string | null
}

export type ConductorBd = {
  id: number
  nombreCompleto: string
  correo: string
  telefono: string
  estado: UsuarioBd['estado']
  rut: string | null
  licenciaHasta: string | null
  activo: boolean
}

export type VanBd = {
  id: string
  patente: string
  asientos: number
  conductorId: number | null
  activa: boolean
}

export type CambiosConductor = {
  rut?: string
  licenciaHasta?: string
  activo?: boolean
  telefono?: string
}

export type CambiosVan = {
  patente?: string
  conductorId?: number | null
  activa?: boolean
}

/** Asiento reservado en un viaje, con los datos del pasajero que ve el administrador o el conductor. */
export type ReservaViajeBd = {
  id: number
  grupoId: string
  usuarioId: number
  nombre: string
  telefono: string
  asiento: number
  estado: 'pendiente' | 'completada' | 'cancelada'
  creadaEn: string
}

/** Viaje tal como lo devuelve el backend (ver docs/api/viajes.md). */
export type ViajeBd = {
  id: number
  fecha: string
  hora: string
  trayecto: Trayecto
  origen: string
  destino: string
  vanId: number | null
  conductorId: number | null
  estado: EstadoViaje
  iniciadoEn: string | null
  finalizadoEn: string | null
  canceladoEn: string | null
  reservas: ReservaViajeBd[]
}

/** Un cambio por solicitud: asignar van y conductor, o cancelar. */
export type CambiosViaje = { vanId: number | null; conductorId: number | null } | { estado: 'cancelado' }

/** Ruta por carretera hacia la sede de destino: puntos [latitud, longitud], metros y segundos. */
export type RutaBd = { coordenadas: [number, number][]; distanciaM: number; duracionS: number }

/** S3-RES-01 (#2605): viaje que el funcionario puede reservar (ver docs/api/reservas.md). */
export type ViajeDisponibleBd = {
  id: number
  fecha: string
  hora: string
  trayecto: Trayecto
  origen: string
  destino: string
  capacidad: number
  ocupados: number
  libres: number
  tengoReserva: boolean
}

/** Asientos de un viaje reservable; `miAsiento` es el propio si ya reservó ahí. */
export type AsientosBd = { viajeId: number; capacidad: number; ocupados: number[]; miAsiento: number | null }

/** Una reserva recién creada con POST /api/reservas. */
export type ReservaCreadaBd = {
  id: number
  viajeId: number
  asiento: number
  fecha: string
  hora: string
  trayecto: Trayecto
  origen: string
  destino: string
}

/** Un trayecto de "Mis reservas" (GET /api/reservas). */
export type MiTrayectoBd = Omit<ReservaCreadaBd, 'id'> & {
  id: number
  estado: EstadoReserva
  estadoViaje: EstadoViaje
  /** se puede cancelar o cambiar de asiento */
  editable: boolean
  capacidad: number
  /** asientos de otras personas en ese viaje */
  ocupados: number[]
  /** cuándo se hizo la reserva (ISO) */
  creadaEn: string
}

/** Una reserva de ida, de vuelta o de ida y vuelta: sus trayectos comparten grupoId. */
export type MiGrupoBd = { grupoId: string; reservas: MiTrayectoBd[] }

export type DatosRegistro = {
  nombreCompleto: string
  correo: string
  contrasena: string
  confirmacion: string
  telefono: string
  sede: string
}

export type Respuesta<T> =
  | { ok: true; datos: T }
  | { ok: false; status: number; error: string }

const SIN_CONEXION = 'No se pudo conectar con el servidor. Revisa que el backend esté corriendo (npm run dev).'

async function pedir<T>(ruta: string, metodo = 'GET', cuerpo?: unknown): Promise<Respuesta<T>> {
  const token = leerSesion()?.token
  const headers: Record<string, string> = {}

  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let respuesta: Response

  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  } catch {
    return { ok: false, status: 0, error: SIN_CONEXION }
  }

  const datos = await respuesta.json().catch(() => null)

  if (respuesta.ok && datos) {
    return { ok: true, datos: datos as T }
  }

  if (!datos) {
    return { ok: false, status: respuesta.status, error: SIN_CONEXION }
  }

  const errores = Object.values((datos.errores ?? {}) as Record<string, string>)
  const error = datos.error ?? (
    errores.join(' ') || 'Ocurrió un error inesperado. Inténtalo de nuevo.'
  )

  return { ok: false, status: respuesta.status, error }
}

export const api = {
  registrar: (datos: DatosRegistro) =>
    pedir<{ usuario: UsuarioBd }>('/auth/registro', 'POST', datos),

  iniciarSesion: (correo: string, contrasena: string) =>
    pedir<{ token: string; usuario: UsuarioBd }>('/auth/login', 'POST', { correo, contrasena }),

  actualizarMiCelular: (telefono: string) =>
    pedir<{ usuario: UsuarioBd }>('/usuarios/me', 'PATCH', { telefono }),

  listarUsuarios: () =>
    pedir<{ usuarios: UsuarioBd[] }>('/admin/usuarios'),

  aprobar: (id: number, rol: Rol) =>
    pedir<{ usuario: UsuarioBd }>(`/admin/solicitudes/${id}/aprobar`, 'POST', { rol }),

  rechazar: (id: number) =>
    pedir<{ usuario: UsuarioBd }>(`/admin/solicitudes/${id}/rechazar`, 'POST'),

  listarConductores: () =>
    pedir<{ conductores: ConductorBd[] }>('/admin/conductores'),

  actualizarConductor: (id: number, cambios: CambiosConductor) =>
    pedir<{ conductor: ConductorBd }>(`/admin/conductores/${id}`, 'PATCH', cambios),
  /** S3-VIA-03, administrador: todos los viajes, abrir ida/vuelta, asignar van y conductor o cancelar. */
  listarViajes: () => pedir<{ viajes: ViajeBd[] }>('/admin/viajes'),
  abrirViajes: (fecha: string, trayectos: Trayecto[]) => pedir<{ viajes: ViajeBd[] }>('/admin/viajes', 'POST', { fecha, trayectos }),
  actualizarViaje: (id: number, cambios: CambiosViaje) => pedir<{ viaje: ViajeBd }>(`/admin/viajes/${id}`, 'PATCH', cambios),
  /** S3-CON-02, conductor: sus viajes (con pasajeros), iniciar y finalizar. */
  listarMisViajes: () => pedir<{ viajes: ViajeBd[] }>('/conductor/viajes'),
  iniciarViaje: (id: number) => pedir<{ viaje: ViajeBd }>(`/conductor/viajes/${id}/iniciar`, 'POST'),
  finalizarViaje: (id: number) => pedir<{ viaje: ViajeBd }>(`/conductor/viajes/${id}/finalizar`, 'POST'),
  /** GPS-05, conductor: ruta desde su posición hasta el destino del viaje (el destino lo decide el backend). */
  calcularRuta: (id: number, latitud: number, longitud: number) =>
    pedir<{ ruta: RutaBd }>(`/conductor/viajes/${id}/ruta?lat=${latitud}&lon=${longitud}`),

  listarVans: () =>
    pedir<{ vans: VanBd[] }>('/admin/vans'),

  crearVan: (datos: { patente: string; conductorId: number | null }) =>
    pedir<{ van: VanBd }>('/admin/vans', 'POST', datos),

  actualizarVan: (id: string, cambios: CambiosVan) =>
    pedir<{ van: VanBd }>(`/admin/vans/${id}`, 'PATCH', cambios),

  /** S3-RES-04 (#2608), funcionario: viajes y asientos para reservar, y sus reservas. */
  viajesDisponibles: () => pedir<{ viajes: ViajeDisponibleBd[] }>('/viajes/disponibles'),
  asientosDeViaje: (id: number) => pedir<AsientosBd>(`/viajes/${id}/asientos`),

  crearReservas: (solicitudes: { viajeId: number; asiento: number }[]) =>
    pedir<{ grupoId: string; reservas: ReservaCreadaBd[] }>('/reservas', 'POST', { solicitudes }),

  misReservas: () => pedir<{ grupos: MiGrupoBd[] }>('/reservas'),
  cancelarReserva: (grupoId: string) => pedir<{ grupoId: string }>(`/reservas/${grupoId}/cancelar`, 'POST'),
  cambiarAsientos: (grupoId: string, cambios: { reservaId: number; asiento: number }[]) =>
    pedir<{ grupoId: string }>(`/reservas/${grupoId}/asientos`, 'PATCH', { cambios }),

  /** Avisos de la campana que la persona ya leyó (tabla avisos_leidos). */
  avisosLeidos: () => pedir<{ leidos: string[] }>('/avisos/leidos'),
  marcarAvisosLeidos: (ids: string[]) => pedir<{ leidos: string[] }>('/avisos/leidos', 'POST', { ids }),
}
