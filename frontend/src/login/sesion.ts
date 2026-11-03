import type { Rol } from '../admin/types'

/** Rol de la sesión: los de las cuentas aprobadas más el administrador. */
export type RolSesion = Rol | 'admin'

export type Sesion = {
  correo: string
  nombre: string
  rol: RolSesion
  /** id del pasajero en el estado compartido; `null` para el administrador */
  pasajeroId: string | null
  /** Token JWT que entrega el backend al iniciar sesión (BD-18); se envía en cada llamada a la API. */
  token?: string
}

/** Pantalla de inicio de cada rol */
export const RUTA_INICIO: Record<RolSesion, string> = {
  admin: '/admin/panel',
  funcionario: '/pasajero/reservar',
  conductor: '/conductor/viajes',
}

const KEY = 'unab-sesion'

/** La sesión vive en sessionStorage: se cierra al cerrar la pestaña. */
export function leerSesion(): Sesion | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Sesion) : null
  } catch {
    return null
  }
}

export function guardarSesion(sesion: Sesion) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(sesion))
  } catch {
    /* sin almacenamiento disponible */
  }
}

export function cerrarSesion() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignorar */
  }
}
