
import { vi } from 'vitest'
import type { ConductorBd, ReservaViajeBd, RutaBd, UsuarioBd, ViajeBd } from '../api'
import { sumarDias, todayISO } from '../admin/utils/format'

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

/* ---------- Reservas del funcionario (S3-RES-01 a S3-RES-04) ---------- */

/** Las vans de prueba son la Hyundai Staria: 9 asientos reservables. */
const CAPACIDAD = 9
let siguienteReserva = 1

const grupoFalso = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Guarda una reserva en un viaje de la "base" (por ejemplo, la de otra persona que ocupa un asiento). */
export function agregarReservaBd(viajeId: number, datos: Partial<ReservaViajeBd> & Pick<ReservaViajeBd, 'usuarioId' | 'asiento'>): ReservaViajeBd {
  const n = siguienteReserva++
  const reserva: ReservaViajeBd = {
    id: n, grupoId: grupoFalso(n), nombre: 'Pasajero de prueba', telefono: '+56912345678', estado: 'pendiente',
    creadaEn: new Date().toISOString(), ...datos,
  }
  viajes.find((v) => v.id === viajeId)!.reservas.push(reserva)
  return reserva
}

const activas = (v: ViajeBd) => v.reservas.filter((r) => r.estado !== 'cancelada')

// Mismas condiciones que el backend: pendiente, con van y de 1 a 30 días desde hoy.
const reservable = (v: ViajeBd) =>
  v.estado === 'pendiente' && v.vanId !== null && v.fecha >= sumarDias(todayISO(), 1) && v.fecha <= sumarDias(todayISO(), 30)

const editable = (v: ViajeBd, r: ReservaViajeBd) => r.estado === 'pendiente' && v.estado === 'pendiente' && v.fecha >= todayISO()

/** Trayectos de una persona con su viaje: los de un grupo, o todos. */
const trayectosDe = (usuarioId: number, grupoId?: string) =>
  viajes.flatMap((v) => v.reservas
    .filter((r) => r.usuarioId === usuarioId && (grupoId === undefined || r.grupoId === grupoId))
    .map((r) => ({ v, r })))

/** Tabla avisos_leidos: ids de avisos leídos por id de cuenta. */
let avisosLeidos = new Map<number, string[]>()

/** Avisos que quedaron marcados como leídos en la "base" para esa cuenta. */
export const avisosLeidosGuardados = (usuarioId: number) => avisosLeidos.get(usuarioId) ?? []

const NO_EDITABLE = 'Esta reserva ya no se puede modificar: el viaje ya salió, se canceló o la reserva no está pendiente.'
const OCUPADO = 'El asiento ya fue reservado por otra persona. Elige otro.'

function atenderFuncionario(url: string, metodo: string, cuerpo: Record<string, unknown>, sesion: Cuenta): Response {
  if (metodo === 'GET' && url === '/api/viajes/disponibles') {
    const lista = viajes.filter(reservable).sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
    return responder(200, {
      viajes: lista.map((v) => ({
        id: v.id, fecha: v.fecha, hora: v.hora, trayecto: v.trayecto, origen: v.origen, destino: v.destino,
        capacidad: CAPACIDAD, ocupados: activas(v).length, libres: CAPACIDAD - activas(v).length,
        tengoReserva: activas(v).some((r) => r.usuarioId === sesion.id),
      })),
    })
  }

  const asientos = url.match(/^\/api\/viajes\/(\d+)\/asientos$/)
  if (metodo === 'GET' && asientos) {
    const viaje = viajes.find((v) => v.id === Number(asientos[1]))
    if (!viaje) return responder(404, { error: 'El viaje no existe.' })
    if (!reservable(viaje)) return responder(409, { error: 'El viaje no está disponible para reservas.' })
    return responder(200, {
      viajeId: viaje.id, capacidad: CAPACIDAD,
      ocupados: activas(viaje).map((r) => r.asiento).sort((a, b) => a - b),
      miAsiento: activas(viaje).find((r) => r.usuarioId === sesion.id)?.asiento ?? null,
    })
  }

  if (metodo === 'POST' && url === '/api/reservas') {
    const solicitudes = cuerpo.solicitudes as { viajeId: number; asiento: number }[]
    for (const s of solicitudes) {
      const viaje = viajes.find((v) => v.id === s.viajeId)
      if (!viaje) return responder(404, { error: 'El viaje seleccionado no existe.' })
      if (!reservable(viaje)) return responder(409, { error: 'El viaje no está disponible para reservas.' })
      if (s.asiento < 1 || s.asiento > CAPACIDAD) return responder(400, { error: 'El asiento supera la capacidad de la van.' })
      if (activas(viaje).some((r) => r.usuarioId === sesion.id)) return responder(409, { error: 'Ya tienes una reserva en este viaje.' })
      if (activas(viaje).some((r) => r.asiento === s.asiento)) return responder(409, { error: OCUPADO })
    }
    const grupoId = grupoFalso(siguienteReserva)
    const reservas = solicitudes.map((s) => {
      const viaje = viajes.find((v) => v.id === s.viajeId)!
      const r = agregarReservaBd(viaje.id, { usuarioId: sesion.id, nombre: sesion.nombreCompleto, asiento: s.asiento, grupoId })
      return {
        id: r.id, viajeId: viaje.id, asiento: r.asiento, fecha: viaje.fecha, hora: viaje.hora,
        trayecto: viaje.trayecto, origen: viaje.origen, destino: viaje.destino,
      }
    })
    return responder(201, { grupoId, reservas })
  }

  if (metodo === 'GET' && url === '/api/reservas') {
    const grupos = new Map<string, unknown[]>()
    for (const { v, r } of trayectosDe(sesion.id)) {
      grupos.set(r.grupoId, [...(grupos.get(r.grupoId) ?? []), {
        id: r.id, viajeId: v.id, trayecto: v.trayecto, fecha: v.fecha, hora: v.hora, origen: v.origen, destino: v.destino,
        asiento: r.asiento, estado: r.estado, estadoViaje: v.estado, editable: editable(v, r), capacidad: CAPACIDAD,
        ocupados: activas(v).filter((o) => o.id !== r.id).map((o) => o.asiento).sort((a, b) => a - b),
        creadaEn: r.creadaEn,
      }])
    }
    return responder(200, { grupos: [...grupos].map(([grupoId, reservas]) => ({ grupoId, reservas })) })
  }

  const cambio = url.match(/^\/api\/reservas\/([\w-]+)\/(cancelar|asientos)$/)
  if (cambio) {
    const propios = trayectosDe(sesion.id, cambio[1])
    if (propios.length === 0) return responder(404, { error: 'La reserva no existe.' })

    if (metodo === 'POST' && cambio[2] === 'cancelar') {
      const elegidos = propios.filter(({ v, r }) => editable(v, r))
      if (elegidos.length === 0) return responder(409, { error: NO_EDITABLE })
      for (const { r } of elegidos) r.estado = 'cancelada'
      return responder(200, { grupoId: cambio[1] })
    }

    if (metodo === 'PATCH' && cambio[2] === 'asientos') {
      const cambios = cuerpo.cambios as { reservaId: number; asiento: number }[]
      for (const c of cambios) {
        const propio = propios.find(({ r }) => r.id === c.reservaId)
        if (!propio) return responder(404, { error: 'La reserva no existe.' })
        if (!editable(propio.v, propio.r)) return responder(409, { error: NO_EDITABLE })
        if (activas(propio.v).some((o) => o.id !== c.reservaId && o.asiento === c.asiento)) return responder(409, { error: OCUPADO })
      }
      for (const c of cambios) propios.find(({ r }) => r.id === c.reservaId)!.r.asiento = c.asiento
      return responder(200, { grupoId: cambio[1] })
    }
  }

  return responder(404, { error: 'Ruta no encontrada.' })
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

  // Avisos leídos: cualquier rol marca y ve solo los suyos.
  if (url === '/api/avisos/leidos') {
    if (metodo === 'POST') {
      const ids = (cuerpo as unknown as { ids: string[] }).ids
      avisosLeidos.set(sesion.id, [...new Set([...avisosLeidosGuardados(sesion.id), ...ids])])
    }
    return responder(200, { leidos: avisosLeidosGuardados(sesion.id) })
  }

  // Panel del funcionario: viajes para reservar y sus propias reservas.
  if (url.startsWith('/api/viajes/') || url.startsWith('/api/reservas')) {
    if (sesion.rol !== 'funcionario' || sesion.estado !== 'aprobada') {
      return responder(403, { error: 'No tienes permiso para realizar esta acción.' })
    }
    return atenderFuncionario(url, metodo, cuerpo, sesion)
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
  siguienteReserva = 1
  avisosLeidos = new Map()
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
