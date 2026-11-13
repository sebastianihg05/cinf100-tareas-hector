
import type { Rol } from './admin/types'
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

  listarVans: () =>
    pedir<{ vans: VanBd[] }>('/admin/vans'),

  crearVan: (datos: { patente: string; conductorId: number | null }) =>
    pedir<{ van: VanBd }>('/admin/vans', 'POST', datos),

  actualizarVan: (id: string, cambios: CambiosVan) =>
    pedir<{ van: VanBd }>(`/admin/vans/${id}`, 'PATCH', cambios),

  crearReservas: (solicitudes: { viajeId: number; asiento: number }[]) =>
    pedir<{ grupoId: string; reservas: unknown[] }>('/reservas', 'POST', { solicitudes }),
}