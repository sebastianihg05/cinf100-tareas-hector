export type Trayecto = 'Ida' | 'Vuelta'
export type EstadoViaje = 'pendiente' | 'en-curso' | 'completado' | 'cancelado'

export type Van = {
  id: string
  patente: string
  asientos: number
  choferId: string | null
  activa: boolean
}

export type Chofer = {
  id: string
  nombre: string
  /** correo institucional: el conductor entra con su cuenta UNAB, sin contraseña propia */
  correo: string
  rut: string
  /** ISO yyyy-mm-dd */
  licenciaHasta: string
  telefono: string
  activo: boolean
}

export type ReservaPasajero = {
  /** ISO yyyy-mm-dd */
  fecha: string
  trayecto: Trayecto
  asiento: number
}

export type Pasajero = {
  id: string
  nombre: string
  email: string
  sede: string
  celular: string
  /** ISO yyyy-mm-ddThh:mm */
  ultimoIngreso: string
  /** cuenta aprobada: puede reservar asientos */
  aprobado: boolean
  /** Dirección de Docencia: abre viajes en días sin viaje fijo */
  puedeAbrirViajes: boolean
  /** si se deshabilita, no puede ingresar al sistema */
  habilitado: boolean
  reserva?: ReservaPasajero
}

export type Viaje = {
  id: string
  origen: string
  destino: string
  trayecto: Trayecto
  /** ISO yyyy-mm-dd */
  fecha: string
  hora: string
  /** null mientras la administración no asigna van y conductor */
  vanId: string | null
  reservados: number
  estado: EstadoViaje
}

export type EstadoReserva = 'pendiente' | 'completada' | 'cancelada'

/**
 * Un asiento reservado en un viaje. Una reserva de "Ida y Vuelta" son dos registros
 * (uno por trayecto) que comparten `grupoId`.
 */
export type Reserva = {
  id: string
  grupoId: string
  pasajeroId: string
  viajeId: string
  trayecto: Trayecto
  asiento: number
  estado: EstadoReserva
  /** ISO yyyy-mm-ddThh:mm */
  creadaEn: string
}

/** El conductor inicia el viaje desde su app; al administrador solo le llega este aviso. */
export type Notificacion = {
  id: string
  tipo: 'viaje-iniciado'
  viajeId: string
  /** ISO yyyy-mm-ddThh:mm */
  fecha: string
  leida: boolean
}

export type Admin = {
  nombre: string
  email: string
  cargo: string
  celular: string
  /** ISO yyyy-mm-ddThh:mm */
  ultimoIngreso: string
}

export const SEDES = ['Quillota 980', 'Quintay', 'Rokamar', 'Santiago'] as const

const CAMPUS: Record<string, string> = { 'Quillota 980': 'Campus Viña del Mar' }

/** "Quillota 980" -> "Quillota 980 (Campus Viña del Mar)" */
export const sedeLabel = (sede: string) => (CAMPUS[sede] ? `${sede} (${CAMPUS[sede]})` : sede)

/** Horarios fijos definidos en el backlog: Ida 06:45, Vuelta 17:00 */
export const HORA_TRAYECTO: Record<Trayecto, string> = { Ida: '06:45', Vuelta: '17:00' }

/** Ruta fija de cada trayecto */
export const RUTA_TRAYECTO: Record<Trayecto, { origen: string; destino: string }> = {
  Ida: { origen: 'Quillota 980', destino: 'Santiago' },
  Vuelta: { origen: 'Santiago', destino: 'Quillota 980' },
}
