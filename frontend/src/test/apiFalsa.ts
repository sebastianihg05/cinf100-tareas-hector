import { vi } from 'vitest'
import type { ConductorBd, RutaBd, UsuarioBd, ViajeBd } from '../api'

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

/** La cuenta tal como quedó en la "base" (por ejemplo, para revisar su celular). */
export const cuentaGuardada = (correo: string) => cuentas.find((c) => c.correo === correo.toLowerCase())

/** Celular en el formato de la base, +569XXXXXXXX, o null si no es válido. */
const celularBd = (valor: string) => {
  const digitos = valor.replace(/\D/g, '')
  const local = digitos.length === 11 && digitos.startsWith('56') ? digitos.slice(2) : digitos
  return /^9\d{8}$/.test(local) ? `+56${local}` : null
}

const aConductor = (cuenta: Cuenta): ConductorBd => ({
  id: cuenta.id, nombreCompleto: cuenta.nombreCompleto, correo: cuenta.correo, telefono: cuenta.telefono,
  estado: cuenta.estado, ...conductores.get(cuenta.id)!,
})

/* ---------- Viajes (S3-VIA-03, S3-CON-02): la tabla viajes y sus reservas, en memoria ---------- */

let viajes: ViajeBd[] = []
let siguienteViaje = 1
/** Ruta que responde el GPS falso: una ruta fija, o un error { status, error }. */
let respuestaRuta: RutaBd | { status: number; error: string } = {
  coordenadas: [[-33.2, -71.4], [-33.435172, -70.634]], distanciaM: 120000, duracionS: 5400,
}
/** Posiciones recibidas por la ruta falsa, para comprobar cuántas consultas se hacen. */
export const consultasRuta: { id: number; lat: number; lon: number }[] = []

/** Agrega un viaje a la "base" (por defecto, una ida pendiente sin asignar) y lo devuelve. */
export function agregarViajeBd(datos: Partial<ViajeBd> = {}): ViajeBd {
  const trayecto = datos.trayecto ?? 'Ida'
  const viaje: ViajeBd = {
    id: siguienteViaje++, fecha: '2099-01-01', hora: trayecto === 'Ida' ? '06:45' : '17:00', trayecto,
    origen: trayecto === 'Ida' ? 'Quillota 980' : 'Santiago', destino: trayecto === 'Ida' ? 'Santiago' : 'Quillota 980',
    vanId: null, conductorId: null, estado: 'pendiente', iniciadoEn: null, finalizadoEn: null, canceladoEn: null, reservas: [],
    ...datos,
  }
  viajes.push(viaje)
  return viaje
}

/** El viaje tal como quedó guardado en la "base". */
export const viajeBdGuardado = (id: number) => viajes.find((v) => v.id === id)

/** Cambia lo que responde la ruta falsa. */
export function configurarRutaFalsa(respuesta: typeof respuestaRuta) {
  respuestaRuta = respuesta
}

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

  const sesion = cuentas.find((c) => token === `token-${c.id}`)
  if (!sesion) return responder(401, { error: 'Debes iniciar sesión.' })

  // Perfil propio: cualquier rol cambia su celular.
  if (metodo === 'PATCH' && url === '/api/usuarios/me') {
    const telefono = celularBd(String(cuerpo.telefono ?? ''))
    if (!telefono) return responder(400, { errores: { telefono: 'Ingresa un celular chileno válido, por ejemplo +56 9 1234 5678.' } })
    sesion.telefono = telefono
    return responder(200, { usuario: publica(sesion) })
  }

  // Panel del conductor: solo ve y cambia los viajes que tiene asignados.
  if (url.startsWith('/api/conductor/')) {
    if (sesion.rol !== 'conductor' || sesion.estado !== 'aprobada') {
      return responder(403, { error: 'No tienes permiso para realizar esta acción.' })
    }
    if (metodo === 'GET' && url === '/api/conductor/viajes') {
      return responder(200, { viajes: viajes.filter((v) => v.conductorId === sesion.id) })
    }
    const accion = url.match(/^\/api\/conductor\/viajes\/(\d+)\/(iniciar|finalizar)$/)
    if (metodo === 'POST' && accion) {
      const viaje = viajes.find((v) => v.id === Number(accion[1]) && v.conductorId === sesion.id)
      if (!viaje) return responder(404, { error: 'No encontramos este viaje entre los que tienes asignados.' })
      const iniciar = accion[2] === 'iniciar'
      if (viaje.estado !== (iniciar ? 'pendiente' : 'en-curso')) {
        return responder(409, { error: iniciar ? 'Solo se puede iniciar un viaje pendiente.' : 'Solo se puede finalizar un viaje en curso.' })
      }
      if (iniciar && viajes.some((v) => v.id !== viaje.id && v.estado === 'en-curso' && (v.conductorId === sesion.id || (viaje.vanId !== null && v.vanId === viaje.vanId)))) {
        return responder(409, { error: 'Ya tienes un viaje en curso. Finalízalo antes de iniciar otro.' })
      }
      const ahora = new Date().toISOString()
      if (iniciar) Object.assign(viaje, { estado: 'en-curso', iniciadoEn: ahora })
      else {
        Object.assign(viaje, { estado: 'completado', finalizadoEn: ahora })
        viaje.reservas = viaje.reservas.map((r) => (r.estado === 'pendiente' ? { ...r, estado: 'completada' } : r))
      }
      return responder(200, { viaje })
    }
    const ruta = url.match(/^\/api\/conductor\/viajes\/(\d+)\/ruta\?lat=(-?[\d.]+)&lon=(-?[\d.]+)$/)
    if (metodo === 'GET' && ruta) {
      const viaje = viajes.find((v) => v.id === Number(ruta[1]) && v.conductorId === sesion.id)
      if (!viaje) return responder(404, { error: 'No encontramos este viaje entre los que tienes asignados.' })
      if (viaje.estado !== 'en-curso') return responder(409, { error: 'La navegación solo está disponible para un viaje en curso.' })
      consultasRuta.push({ id: viaje.id, lat: Number(ruta[2]), lon: Number(ruta[3]) })
      return 'error' in respuestaRuta ? responder(respuestaRuta.status, { error: respuestaRuta.error }) : responder(200, { ruta: respuestaRuta })
    }
    return responder(404, { error: 'Ruta no encontrada.' })
  }

  // Administración: exige el token de una cuenta de administrador aprobada.
  if (sesion.rol !== 'administrador' || sesion.estado !== 'aprobada') {
    return responder(403, { error: 'No tienes permiso para realizar esta acción.' })
  }
  if (metodo === 'GET' && url === '/api/admin/usuarios') return responder(200, { usuarios: cuentas.map(publica) })

  if (metodo === 'GET' && url === '/api/admin/viajes') return responder(200, { viajes })

  if (metodo === 'POST' && url === '/api/admin/viajes') {
    const trayectos = (cuerpo as unknown as { trayectos: ('Ida' | 'Vuelta')[] }).trayectos
    const fecha = String(cuerpo.fecha)
    if (viajes.some((v) => v.fecha === fecha && v.estado !== 'cancelado' && trayectos.includes(v.trayecto))) {
      return responder(409, { error: 'Ya hay un viaje abierto ese día para el trayecto elegido.' })
    }
    return responder(201, { viajes: trayectos.map((trayecto) => agregarViajeBd({ fecha, trayecto })) })
  }

  const cambioViaje = url.match(/^\/api\/admin\/viajes\/(\d+)$/)
  if (metodo === 'PATCH' && cambioViaje) {
    const viaje = viajes.find((v) => v.id === Number(cambioViaje[1]))
    if (!viaje) return responder(404, { error: 'El viaje no existe.' })
    if (viaje.estado !== 'pendiente') return responder(409, { error: 'Solo se puede modificar un viaje pendiente.' })
    if (cuerpo.estado === 'cancelado') {
      Object.assign(viaje, { estado: 'cancelado', canceladoEn: new Date().toISOString() })
      viaje.reservas = viaje.reservas.map((r) => (r.estado === 'pendiente' ? { ...r, estado: 'cancelada' } : r))
    } else {
      const c = cuerpo as unknown as { vanId: number | null; conductorId: number | null }
      Object.assign(viaje, { vanId: c.vanId ?? null, conductorId: c.conductorId ?? null })
    }
    return responder(200, { viaje })
  }

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
    const { telefono, ...cambios } = cuerpo as Partial<DatosConductor> & { telefono?: string }
    const celular = telefono === undefined ? undefined : celularBd(telefono)
    if (celular === null) return responder(400, { errores: { telefono: 'Ingresa un celular chileno válido, por ejemplo +56 9 1234 5678.' } })
    const repetido = cambios.rut && [...conductores].some(([id, d]) => id !== cuenta.id && d.rut === cambios.rut)
    if (repetido) return responder(409, { errores: { rut: 'Ya existe un conductor con ese RUT.' } })
    Object.assign(datos, cambios)
    if (celular) cuenta.telefono = celular
    return responder(200, { conductor: aConductor(cuenta) })
  }

  return responder(404, { error: 'Ruta no encontrada.' })
}

/** Reemplaza `fetch` por el backend falso, con un administrador y la funcionaria de ejemplo Constanza Silva. */
export function instalarApiFalsa() {
  cuentas = []
  conductores = new Map()
  viajes = []
  siguienteViaje = 1
  consultasRuta.length = 0
  respuestaRuta = { coordenadas: [[-33.2, -71.4], [-33.435172, -70.634]], distanciaM: 120000, duracionS: 5400 }
  agregarCuenta({ nombreCompleto: 'Administrador Desarrollo', correo: 'dev.admin@unab.cl', sede: null, rol: 'administrador', estado: 'aprobada' })
  agregarCuenta({ nombreCompleto: 'Constanza Silva', correo: 'S.constanza@uandresbello.edu', rol: 'funcionario', estado: 'aprobada' })

  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const cabeceras = (init.headers ?? {}) as Record<string, string>
    const token = cabeceras.Authorization?.replace('Bearer ', '')
    const cuerpo = init.body ? JSON.parse(String(init.body)) : {}
    return atender(url, init.method ?? 'GET', cuerpo, token)
  })
}
