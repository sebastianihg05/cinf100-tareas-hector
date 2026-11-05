import type { Rol } from './admin/types'
import { leerSesion } from './login/sesion'

/** Cuenta tal como la devuelve el backend (ver docs/api/autenticacion.md). Nunca trae la contraseña. */
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

/** Conductor guardado en la base: su cuenta más RUT y licencia (vacíos hasta que el administrador los complete). */
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

export type CambiosConductor = { rut?: string; licenciaHasta?: string; activo?: boolean }

export type DatosRegistro = {
  nombreCompleto: string
  correo: string
  contrasena: string
  confirmacion: string
  telefono: string
  sede: string
}

export type Respuesta<T> = { ok: true; datos: T } | { ok: false; status: number; error: string }

const SIN_CONEXION = 'No se pudo conectar con el servidor. Revisa que el backend esté corriendo (npm run dev).'

/**
 * Llama a la API del backend. En desarrollo, Vite reenvía /api a http://localhost:3000 (vite.config.ts).
 * Si hay sesión, envía su token. Nunca lanza errores: devuelve `ok: false` con un mensaje para mostrar.
 */
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
  if (respuesta.ok && datos) return { ok: true, datos: datos as T }
  // Sin JSON: respondió Vite porque el backend no está levantado.
  if (!datos) return { ok: false, status: respuesta.status, error: SIN_CONEXION }
  // El backend responde { error } o, en el registro, { errores: { campo: mensaje } }.
  const errores = Object.values((datos.errores ?? {}) as Record<string, string>)
  const error = datos.error ?? (errores.join(' ') || 'Ocurrió un error inesperado. Inténtalo de nuevo.')
  return { ok: false, status: respuesta.status, error }
}

export const api = {
  /** BD-17: crea una solicitud de cuenta (queda pendiente y sin rol). */
  registrar: (datos: DatosRegistro) => pedir<{ usuario: UsuarioBd }>('/auth/registro', 'POST', datos),
  /** BD-18: inicia sesión y devuelve el token y la cuenta. */
  iniciarSesion: (correo: string, contrasena: string) =>
    pedir<{ token: string; usuario: UsuarioBd }>('/auth/login', 'POST', { correo, contrasena }),
  /** Administración (BD-15, BD-16): requiere sesión de administrador. */
  listarUsuarios: () => pedir<{ usuarios: UsuarioBd[] }>('/admin/usuarios'),
  aprobar: (id: number, rol: Rol) => pedir<{ usuario: UsuarioBd }>(`/admin/solicitudes/${id}/aprobar`, 'POST', { rol }),
  rechazar: (id: number) => pedir<{ usuario: UsuarioBd }>(`/admin/solicitudes/${id}/rechazar`, 'POST'),
  /** Conductores de la base con su RUT y licencia (solo administradores). */
  listarConductores: () => pedir<{ conductores: ConductorBd[] }>('/admin/conductores'),
  actualizarConductor: (id: number, cambios: CambiosConductor) =>
    pedir<{ conductor: ConductorBd }>(`/admin/conductores/${id}`, 'PATCH', cambios),
}
