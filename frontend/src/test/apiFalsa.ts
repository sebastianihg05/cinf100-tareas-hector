import { vi } from 'vitest'
import type { ConductorBd, UsuarioBd } from '../api'

/**
 * Backend falso para las pruebas: responde como la API real (docs/api/) pero guarda las cuentas en memoria.
 * setup.ts lo instala antes de cada prueba, así que cada prueba parte con las mismas cuentas.
 */

/** Contraseña de las cuentas iniciales. */
export const CONTRASENA = 'Segura.2026'

type Cuenta = UsuarioBd & { contrasena: string }

let cuentas: Cuenta[] = []

type DatosConductor = { rut: string | null; licenciaHasta: string | null; activo: boolean }

/** Tabla conductores: RUT, licencia y estado por id de cuenta. */
let conductores = new Map<number, DatosConductor>()

/** Registra los datos de conductor de una cuenta (como la tabla conductores). */
export function agregarConductor(id: number, datos: Partial<DatosConductor> = {}) {
  conductores.set(id, { rut: null, licenciaHasta: null, activo: true, ...datos })
}

/** Lo que quedó guardado en la "base" para ese conductor. */
export const conductorGuardado = (id: number) => conductores.get(id)

const aConductor = (cuenta: Cuenta): ConductorBd => ({
  id: cuenta.id, nombreCompleto: cuenta.nombreCompleto, correo: cuenta.correo, telefono: cuenta.telefono,
  estado: cuenta.estado, ...conductores.get(cuenta.id)!,
})

/** Agrega una cuenta (por ejemplo, una desactivada) y la devuelve. */
export function agregarCuenta(datos: Partial<Cuenta> & Pick<UsuarioBd, 'nombreCompleto' | 'correo'>): Cuenta {
  const cuenta: Cuenta = {
    id: cuentas.length + 1,
    telefono: '+56912345678',
    sede: 'Quillota 980',
    rol: null,
    estado: 'pendiente',
    creadoEn: new Date().toISOString(),
    ultimoIngresoEn: null,
    contrasena: CONTRASENA,
    ...datos,
    correo: datos.correo.trim().toLowerCase(),
  }
  cuentas.push(cuenta)
  return cuenta
}

const BLOQUEOS = {
  pendiente: 'Tu cuenta está pendiente de aprobación por un administrador.',
  rechazada: 'Tu solicitud de registro fue rechazada.',
  desactivada: 'Tu cuenta está desactivada. Contacta a la administración.',
}

const responder = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

/** La API nunca devuelve la contraseña. */
const publica = ({ contrasena: _, ...usuario }: Cuenta): UsuarioBd => usuario

function atender(url: string, metodo: string, cuerpo: Record<string, string>, token?: string): Response {
  if (metodo === 'POST' && url === '/api/auth/login') {
    const correo = (cuerpo.correo ?? '').trim().toLowerCase()
    if (!correo || !cuerpo.contrasena) return responder(400, { error: 'Ingresa tu correo y tu contraseña.' })
    const cuenta = cuentas.find((c) => c.correo === correo)
    if (!cuenta || cuenta.contrasena !== cuerpo.contrasena) return responder(401, { error: 'Correo o contraseña incorrectos.' })
    if (cuenta.estado !== 'aprobada') return responder(403, { error: BLOQUEOS[cuenta.estado], estado: cuenta.estado })
    cuenta.ultimoIngresoEn = new Date().toISOString()
    return responder(200, { token: `token-${cuenta.id}`, usuario: publica(cuenta) })
  }

  if (metodo === 'POST' && url === '/api/auth/registro') {
    const correo = (cuerpo.correo ?? '').trim().toLowerCase()
    if (cuentas.some((c) => c.correo === correo)) {
      return responder(409, { errores: { correo: 'Ya existe una cuenta con este correo.' } })
    }
    const cuenta = agregarCuenta({
      nombreCompleto: cuerpo.nombreCompleto, correo, contrasena: cuerpo.contrasena,
      telefono: `+569${cuerpo.telefono.replace(/\D/g, '').slice(-8)}`, sede: cuerpo.sede,
    })
    return responder(201, { usuario: publica(cuenta) })
  }

  // Administración: exige el token de una cuenta de administrador aprobada.
  const sesion = cuentas.find((c) => token === `token-${c.id}`)
  if (!sesion) return responder(401, { error: 'Debes iniciar sesión.' })
  if (sesion.rol !== 'administrador' || sesion.estado !== 'aprobada') {
    return responder(403, { error: 'No tienes permiso para realizar esta acción.' })
  }
  if (metodo === 'GET' && url === '/api/admin/usuarios') return responder(200, { usuarios: cuentas.map(publica) })

  const decision = url.match(/^\/api\/admin\/solicitudes\/(\d+)\/(aprobar|rechazar)$/)
  if (metodo === 'POST' && decision) {
    const cuenta = cuentas.find((c) => c.id === Number(decision[1]))
    if (!cuenta) return responder(404, { error: 'La solicitud no existe.' })
    if (cuenta.estado !== 'pendiente') return responder(409, { error: 'Esta solicitud ya fue resuelta.' })
    if (decision[2] === 'aprobar') Object.assign(cuenta, { estado: 'aprobada', rol: cuerpo.rol })
    else cuenta.estado = 'rechazada'
    if (cuenta.rol === 'conductor' && !conductores.has(cuenta.id)) agregarConductor(cuenta.id)
    return responder(200, { usuario: publica(cuenta) })
  }

  if (metodo === 'GET' && url === '/api/admin/conductores') {
    return responder(200, { conductores: cuentas.filter((c) => conductores.has(c.id)).map(aConductor) })
  }

  const conductor = url.match(/^\/api\/admin\/conductores\/(\d+)$/)
  if (metodo === 'PATCH' && conductor) {
    const cuenta = cuentas.find((c) => c.id === Number(conductor[1]))
    const datos = cuenta && conductores.get(cuenta.id)
    if (!cuenta || !datos) return responder(404, { error: 'El conductor no existe.' })
    const cambios = cuerpo as Partial<DatosConductor>
    const repetido = cambios.rut && [...conductores].some(([id, d]) => id !== cuenta.id && d.rut === cambios.rut)
    if (repetido) return responder(409, { errores: { rut: 'Ya existe un conductor con ese RUT.' } })
    Object.assign(datos, cambios)
    return responder(200, { conductor: aConductor(cuenta) })
  }

  return responder(404, { error: 'Ruta no encontrada.' })
}

/** Reemplaza `fetch` por el backend falso, con un administrador y la funcionaria de ejemplo Constanza Silva. */
export function instalarApiFalsa() {
  cuentas = []
  conductores = new Map()
  agregarCuenta({ nombreCompleto: 'Administrador Desarrollo', correo: 'dev.admin@unab.cl', sede: null, rol: 'administrador', estado: 'aprobada' })
  agregarCuenta({ nombreCompleto: 'Constanza Silva', correo: 'S.constanza@uandresbello.edu', rol: 'funcionario', estado: 'aprobada' })

  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const cabeceras = (init.headers ?? {}) as Record<string, string>
    const token = cabeceras.Authorization?.replace('Bearer ', '')
    const cuerpo = init.body ? JSON.parse(String(init.body)) : {}
    return atender(url, init.method ?? 'GET', cuerpo, token)
  })
}
