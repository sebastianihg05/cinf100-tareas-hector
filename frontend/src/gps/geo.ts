/**
 * Cálculos puros del GPS (GPS-06): distancias, avance sobre la ruta y formatos para mostrar.
 * No usan el navegador ni el mapa, así que se prueban con posiciones simuladas.
 */

/** [latitud, longitud] en grados, el orden que usa el mapa. */
export type Punto = readonly [number, number]

const RADIO_TIERRA_M = 6_371_000
const aRadianes = (grados: number) => (grados * Math.PI) / 180

/** Distancia en metros entre dos puntos, en línea recta sobre la superficie terrestre (haversine). */
export function distanciaM(a: Punto, b: Punto): number {
  const dLat = aRadianes(b[0] - a[0])
  const dLon = aRadianes(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aRadianes(a[0])) * Math.cos(aRadianes(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Ruta con la distancia acumulada de cada punto, calculada una sola vez para no repetirla en cada lectura del GPS. */
export type RutaMedida = { puntos: readonly Punto[]; acumulado: number[]; largoM: number }

export function medirRuta(puntos: readonly Punto[]): RutaMedida {
  const acumulado = [0]
  for (let i = 1; i < puntos.length; i++) acumulado.push(acumulado[i - 1] + distanciaM(puntos[i - 1], puntos[i]))
  return { puntos, acumulado, largoM: acumulado[acumulado.length - 1] ?? 0 }
}

export type Avance = {
  /** metros entre la posición y el punto más cercano de la ruta: indica si el conductor se salió de ella */
  distanciaARutaM: number
  /** metros que faltan, siguiendo la ruta, desde el punto más cercano hasta el final */
  restanteM: number
}

/** Dónde está la posición respecto de la ruta: cuánto se aleja de ella y cuánto falta para llegar. */
export function avanceEnRuta(posicion: Punto, ruta: RutaMedida): Avance {
  const { puntos, acumulado, largoM } = ruta
  if (puntos.length === 0) return { distanciaARutaM: Infinity, restanteM: 0 }
  if (puntos.length === 1) {
    const d = distanciaM(posicion, puntos[0])
    return { distanciaARutaM: d, restanteM: d }
  }

  // Proyección plana alrededor de la posición: suficiente para tramos de pocos kilómetros.
  const mPorGradoLat = 110_540
  const mPorGradoLon = 111_320 * Math.cos(aRadianes(posicion[0]))
  const aMetros = (p: Punto): [number, number] => [(p[1] - posicion[1]) * mPorGradoLon, (p[0] - posicion[0]) * mPorGradoLat]

  let mejor = { distancia: Infinity, restante: largoM }
  for (let i = 0; i < puntos.length - 1; i++) {
    const [ax, ay] = aMetros(puntos[i])
    const [bx, by] = aMetros(puntos[i + 1])
    const dx = bx - ax
    const dy = by - ay
    const largo2 = dx * dx + dy * dy
    // t: en qué parte del tramo cae la posición (0 = inicio, 1 = fin); el origen (0,0) es la posición
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / largo2))
    const distancia = Math.hypot(ax + t * dx, ay + t * dy)
    if (distancia < mejor.distancia) {
      const tramo = acumulado[i + 1] - acumulado[i]
      mejor = { distancia, restante: Math.max(0, largoM - (acumulado[i] + t * tramo)) }
    }
  }
  return { distanciaARutaM: mejor.distancia, restanteM: mejor.restante }
}

/** Tiempo que falta, repartiendo la duración total de la ruta en proporción a la distancia que queda. */
export function duracionRestanteS(restanteM: number, ruta: { distanciaM: number; duracionS: number }): number {
  if (ruta.distanciaM <= 0) return 0
  return Math.round(ruta.duracionS * Math.min(1, restanteM / ruta.distanciaM))
}

/** "850 m", "12,4 km". */
export function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${Math.max(0, Math.round(metros / 10) * 10)} m`
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`
}

/** "menos de 1 min", "45 min", "1 h 23 min". */
export function formatearDuracion(segundos: number): string {
  const minutos = Math.round(segundos / 60)
  if (minutos < 1) return 'menos de 1 min'
  if (minutos < 60) return `${minutos} min`
  const m = minutos % 60
  return m === 0 ? `${Math.floor(minutos / 60)} h` : `${Math.floor(minutos / 60)} h ${m} min`
}

/** Hora estimada de llegada ("14:05") sumando el tiempo restante a la hora actual. */
export function horaLlegada(ahoraMs: number, restanteS: number): string {
  const llegada = new Date(ahoraMs + restanteS * 1000)
  return `${String(llegada.getHours()).padStart(2, '0')}:${String(llegada.getMinutes()).padStart(2, '0')}`
}
