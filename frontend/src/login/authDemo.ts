import type { State } from '../admin/store/adminStore'
import type { Sesion } from './sesion'


/** Credencial de demostración; no es una clave real y desaparece con el backend. */
export const PASSWORD_DEMO = 'Unab.2026'

export type Resultado = { ok: true; sesion: Sesion } | { ok: false; error: string }

const ERROR_CREDENCIALES = 'Correo o contraseña incorrectos.'

/* ---------- Almacén de credenciales (solo hashes) ---------- */

const KEY = 'unab-credenciales-demo'

function leerCredenciales(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

/** SHA-256 de `correo:contraseña`. Si el navegador no ofrece `crypto.subtle` (http fuera de localhost), usa un hash simple. */
async function hashear(correo: string, password: string): Promise<string> {
  const texto = `${correo}:${password}`
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
    return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return `simple-${(h >>> 0).toString(16)}`
}

/** Guarda la contraseña elegida al registrarse (solo su hash). */
export async function guardarCredencial(correo: string, password: string): Promise<void> {
  const mail = correo.trim().toLowerCase()
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...leerCredenciales(), [mail]: await hashear(mail, password) }))
  } catch {
    /* sin almacenamiento: la cuenta quedará con la contraseña de demostración */
  }
}

/** Borra la contraseña guardada (su hash) de una cuenta eliminada. */
export function borrarCredencial(correo: string): void {
  const todas = leerCredenciales()
  delete todas[correo.trim().toLowerCase()]
  try {
    localStorage.setItem(KEY, JSON.stringify(todas))
  } catch {
    /* ignorar */
  }
}

async function contrasenaCorrecta(correo: string, password: string): Promise<boolean> {
  const guardado = leerCredenciales()[correo]
  if (guardado) return guardado === (await hashear(correo, password))
  return password === PASSWORD_DEMO
}

/* ---------- Inicio de sesión ---------- */

/**
 * Valida la contraseña primero (el mismo mensaje para correo desconocido o clave errónea, para no revelar
 * qué correos existen) y luego el estado de la cuenta: aprobada, habilitada y con su rol asignado.
 */
export async function autenticar(correoIngresado: string, password: string, state: State): Promise<Resultado> {
  const correo = correoIngresado.trim().toLowerCase()

  if (correo === state.admin.email.toLowerCase()) {
    if (password !== PASSWORD_DEMO) return { ok: false, error: ERROR_CREDENCIALES }
    return { ok: true, sesion: { correo, nombre: state.admin.nombre, rol: 'admin', pasajeroId: null } }
  }

  const pasajero = state.pasajeros.find((p) => p.email.toLowerCase() === correo)
  if (!pasajero || !(await contrasenaCorrecta(correo, password))) return { ok: false, error: ERROR_CREDENCIALES }

  if (!pasajero.aprobado) return { ok: false, error: 'Tu solicitud está pendiente de aprobación por un administrador.' }
  if (!pasajero.habilitado) return { ok: false, error: 'Tu cuenta está deshabilitada. Contacta al administrador.' }

  return {
    ok: true,
    sesion: { correo, nombre: pasajero.nombre, rol: pasajero.rol ?? 'funcionario', pasajeroId: pasajero.id },
  }
}
