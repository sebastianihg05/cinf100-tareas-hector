
import { RUTA_TRAYECTO, type Trayecto, type Viaje } from '../admin/types'

/** Únicas sedes que participan en el trayecto institucional actual. */
export type CodigoSedeGps = 'Quillota 980' | 'Santiago'

export type SedeGps = Readonly<{
  codigo: CodigoSedeGps
  nombre: string
  direccion: string
  latitud: number
  longitud: number
}>

/**
 * Coordenadas de referencia de los campus publicadas en el Diagnóstico
 * Energético UNAB (2022). No representan necesariamente el lugar exacto
 * donde la van recoge o deja a los pasajeros.
 */
export const SEDES_GPS: Readonly<Record<CodigoSedeGps, SedeGps>> = {
  'Quillota 980': {
    codigo: 'Quillota 980',
    nombre: 'Campus Viña del Mar',
    direccion: 'Quillota 980, Viña del Mar, Región de Valparaíso, Chile',
    latitud: -33.013281,
    longitud: -71.541247,
  },
  Santiago: {
    codigo: 'Santiago',
    nombre: 'Campus Bellavista',
    direccion: 'Bellavista 0121, Providencia, Región Metropolitana, Chile',
    latitud: -33.435172,
    longitud: -70.634000,
  },
}

export type ResultadoRutaGps =
  | Readonly<{ ok: true; origen: SedeGps; destino: SedeGps }>
  | Readonly<{ ok: false; error: string }>

/**
 * Resuelve origen y destino a partir del viaje asignado. No recibe un destino
 * editable: respeta la ruta institucional configurada para Ida o Vuelta.
 *
 * En el futuro, la vista GPS debe utilizar este resultado y no permitir
 * que el conductor cambie el destino manualmente.
 */
export function resolverRutaGps(
  viaje: Pick<Viaje, 'trayecto' | 'origen' | 'destino'>,
): ResultadoRutaGps {
  if (viaje.trayecto !== 'Ida' && viaje.trayecto !== 'Vuelta') {
    return { ok: false, error: 'El trayecto del viaje no es válido.' }
  }

  const trayecto: Trayecto = viaje.trayecto
  const rutaInstitucional = RUTA_TRAYECTO[trayecto]

  if (viaje.origen !== rutaInstitucional.origen || viaje.destino !== rutaInstitucional.destino) {
    return { ok: false, error: 'El viaje tiene una ruta que no está configurada para el GPS.' }
  }

  const origen = SEDES_GPS[rutaInstitucional.origen as CodigoSedeGps]
  const destino = SEDES_GPS[rutaInstitucional.destino as CodigoSedeGps]

  if (!origen || !destino) {
    return { ok: false, error: 'Falta configurar la ubicación de origen o destino.' }
  }

  if (![origen.latitud, origen.longitud, destino.latitud, destino.longitud].every(Number.isFinite)) {
    return { ok: false, error: 'Las coordenadas del trayecto no son válidas.' }
  }

  return { ok: true, origen, destino }
}

/** Formato requerido por openrouteservice: [longitud, latitud]. */
export function coordenadasParaRutas(sede: SedeGps): [number, number] {
  return [sede.longitud, sede.latitud]
}
