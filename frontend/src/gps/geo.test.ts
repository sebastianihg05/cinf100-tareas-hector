import { describe, expect, it } from 'vitest'
import { avanceEnRuta, distanciaM, duracionRestanteS, formatearDistancia, formatearDuracion, horaLlegada, medirRuta, type Punto } from './geo'

/** GPS-06 y GPS-08: cálculos de distancia y avance con posiciones simuladas. */

// Tramo recto hacia el este, de unos 1.110 m por cada 0,01° de longitud a esta latitud
const A: Punto = [-33.0, -71.0]
const B: Punto = [-33.0, -70.99]
const C: Punto = [-33.0, -70.98]
const ruta = medirRuta([A, B, C])

describe('distanciaM', () => {
  it('es cero entre el mismo punto y simétrica entre dos', () => {
    expect(distanciaM(A, A)).toBe(0)
    expect(distanciaM(A, C)).toBeCloseTo(distanciaM(C, A), 6)
  })

  it('entre las dos sedes es de unos 100 km', () => {
    const km = distanciaM([-33.013281, -71.541247], [-33.435172, -70.634]) / 1000
    expect(km).toBeGreaterThan(90)
    expect(km).toBeLessThan(110)
  })
})

describe('avanceEnRuta', () => {
  it('en el inicio falta toda la ruta y la distancia a la ruta es cero', () => {
    const a = avanceEnRuta(A, ruta)
    expect(a.distanciaARutaM).toBeCloseTo(0, 0)
    expect(a.restanteM).toBeCloseTo(ruta.largoM, 0)
  })

  it('a mitad de camino falta la mitad', () => {
    const a = avanceEnRuta(B, ruta)
    expect(a.restanteM).toBeCloseTo(ruta.largoM / 2, -1)
  })

  it('el restante baja a medida que la posición avanza', () => {
    const antes = avanceEnRuta([-33.0, -70.995], ruta).restanteM
    const despues = avanceEnRuta([-33.0, -70.985], ruta).restanteM
    expect(despues).toBeLessThan(antes)
  })

  it('una posición alejada de la ruta informa cuánto se desvió', () => {
    // 0,01° de latitud al sur ≈ 1,1 km
    const a = avanceEnRuta([-33.01, -70.99], ruta)
    expect(a.distanciaARutaM).toBeGreaterThan(1000)
    expect(a.distanciaARutaM).toBeLessThan(1200)
  })

  it('más allá del final no queda distancia por recorrer', () => {
    expect(avanceEnRuta([-33.0, -70.97], ruta).restanteM).toBeCloseTo(0, 0)
  })

  it('una ruta vacía no rompe el cálculo', () => {
    expect(avanceEnRuta(A, medirRuta([]))).toEqual({ distanciaARutaM: Infinity, restanteM: 0 })
  })
})

describe('duracionRestanteS', () => {
  const total = { distanciaM: 10_000, duracionS: 600 }
  it('reparte la duración según la distancia que queda', () => {
    expect(duracionRestanteS(10_000, total)).toBe(600)
    expect(duracionRestanteS(2_500, total)).toBe(150)
    expect(duracionRestanteS(0, total)).toBe(0)
  })
  it('no supera la duración total ni falla con una ruta sin distancia', () => {
    expect(duracionRestanteS(50_000, total)).toBe(600)
    expect(duracionRestanteS(100, { distanciaM: 0, duracionS: 0 })).toBe(0)
  })
})

describe('formatos', () => {
  it('distancia en metros o kilómetros', () => {
    expect(formatearDistancia(849)).toBe('850 m')
    expect(formatearDistancia(12_430)).toBe('12,4 km')
  })
  it('duración en minutos u horas', () => {
    expect(formatearDuracion(20)).toBe('menos de 1 min')
    expect(formatearDuracion(45 * 60)).toBe('45 min')
    expect(formatearDuracion(83 * 60)).toBe('1 h 23 min')
    expect(formatearDuracion(2 * 3600)).toBe('2 h')
  })
  it('hora de llegada con dos dígitos', () => {
    const ahora = new Date(2099, 0, 4, 8, 50).getTime()
    expect(horaLlegada(ahora, 20 * 60)).toBe('09:10')
  })
})
