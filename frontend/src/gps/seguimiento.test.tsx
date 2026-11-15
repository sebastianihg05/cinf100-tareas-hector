import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agregarConductor, agregarCuenta, agregarViajeBd, configurarRutaFalsa, consultasRuta } from '../test/apiFalsa'
import { INTERVALO_MANUAL_MS, INTERVALO_RECALCULO_MS, useRutaGps } from './useRutaGps'
import { SENAL_PERDIDA_MS, useSeguimientoGps, type Posicion } from './useSeguimientoGps'

/** GPS-04, GPS-05 y GPS-08: seguimiento de la ubicación y cálculo de ruta con un GPS simulado. */

type Exito = (p: GeolocationPosition) => void
type Fallo = (e: GeolocationPositionError) => void

/** Instala un `navigator.geolocation` falso que deja enviar posiciones y errores a mano. */
function instalarGeolocalizacion() {
  let exito: Exito = () => {}
  let fallo: Fallo = () => {}
  const watchPosition = vi.fn((e: Exito, f: Fallo) => { exito = e; fallo = f; return 7 })
  const clearWatch = vi.fn()
  Object.defineProperty(navigator, 'geolocation', { value: { watchPosition, clearWatch }, configurable: true })
  return {
    watchPosition, clearWatch,
    enviar: (lat: number, lon: number) =>
      exito({ coords: { latitude: lat, longitude: lon, accuracy: 8 }, timestamp: Date.now() } as GeolocationPosition),
    error: (code: number) => fallo({ code, message: 'x' } as GeolocationPositionError),
  }
}

afterEach(() => {
  cleanup() // desmonta antes de quitar la geolocalización falsa, que el componente usa al limpiar
  vi.useRealTimers()
  Reflect.deleteProperty(navigator, 'geolocation')
})

describe('useSeguimientoGps', () => {
  it('pide la ubicación y pasa a activo cuando llega una posición', () => {
    const gps = instalarGeolocalizacion()
    const { result } = renderHook(() => useSeguimientoGps(true))
    expect(gps.watchPosition).toHaveBeenCalledTimes(1)
    expect(result.current.estado).toBe('solicitando')

    act(() => gps.enviar(-33.1, -71.5))
    expect(result.current.estado).toBe('activo')
    expect(result.current.posicion).toMatchObject({ lat: -33.1, lon: -71.5, precisionM: 8 })
  })

  it('si la persona rechaza el permiso queda denegado, con mensaje y sin seguir consultando', () => {
    const gps = instalarGeolocalizacion()
    const { result } = renderHook(() => useSeguimientoGps(true))
    act(() => gps.error(1))
    expect(result.current.estado).toBe('denegado')
    expect(result.current.mensaje).toMatch(/permiso/i)
    expect(gps.clearWatch).toHaveBeenCalled()
  })

  it('un error de señal no detiene el seguimiento y se recupera con la siguiente lectura', () => {
    const gps = instalarGeolocalizacion()
    const { result } = renderHook(() => useSeguimientoGps(true))
    act(() => gps.enviar(-33.1, -71.5))
    act(() => gps.error(2))
    expect(result.current.estado).toBe('sin-senal')
    act(() => gps.enviar(-33.11, -71.49))
    expect(result.current.estado).toBe('activo')
  })

  it('sin lecturas durante el tiempo máximo se considera señal perdida', () => {
    vi.useFakeTimers()
    const gps = instalarGeolocalizacion()
    const { result } = renderHook(() => useSeguimientoGps(true))
    act(() => gps.enviar(-33.1, -71.5))
    act(() => { vi.advanceTimersByTime(SENAL_PERDIDA_MS + 6_000) })
    expect(result.current.estado).toBe('sin-senal')
  })

  it('un navegador sin geolocalización lo informa', () => {
    Reflect.deleteProperty(navigator, 'geolocation')
    const { result } = renderHook(() => useSeguimientoGps(true))
    expect(result.current.estado).toBe('sin-soporte')
  })

  it('al salir de la pantalla deja de consultar la ubicación', () => {
    const gps = instalarGeolocalizacion()
    const { unmount } = renderHook(() => useSeguimientoGps(true))
    unmount()
    expect(gps.clearWatch).toHaveBeenCalledWith(7)
  })

  it('reintentar vuelve a pedir la ubicación', () => {
    const gps = instalarGeolocalizacion()
    const { result } = renderHook(() => useSeguimientoGps(true))
    act(() => result.current.reintentar())
    expect(gps.watchPosition).toHaveBeenCalledTimes(2)
  })
})

describe('useRutaGps', () => {
  const pos = (lat: number, lon: number): Posicion => ({ lat, lon, precisionM: 5, marca: Date.now() })
  // ruta fija del GPS falso: de [-33.2, -71.4] a [-33.435172, -70.634]
  const SOBRE_LA_RUTA = pos(-33.2, -71.4)
  const LEJOS = pos(-33.0, -71.0)

  let conductorId = 0
  /** Viaje En curso del conductor con sesión iniciada: la ruta solo se entrega al conductor del viaje. */
  const viajeEnCurso = () => agregarViajeBd({ estado: 'en-curso', vanId: 1, conductorId })

  beforeEach(() => {
    const cuenta = agregarCuenta({ nombreCompleto: 'Juan Carrasco', correo: 'dev.conductor@unab.cl', rol: 'conductor', estado: 'aprobada' })
    agregarConductor(cuenta.id)
    conductorId = cuenta.id
    sessionStorage.setItem('unab-sesion', JSON.stringify({ correo: cuenta.correo, nombre: cuenta.nombreCompleto, rol: 'conductor', pasajeroId: null, token: `token-${cuenta.id}` }))
    consultasRuta.length = 0
    configurarRutaFalsa({ coordenadas: [[-33.2, -71.4], [-33.435172, -70.634]], distanciaM: 120000, duracionS: 5400 })
  })

  it('pide la ruta una sola vez mientras el conductor avanza sobre ella', async () => {
    const viaje = viajeEnCurso()
    const { result, rerender } = renderHook(({ p }) => useRutaGps(viaje.id, p, true), { initialProps: { p: SOBRE_LA_RUTA as Posicion | null } })
    await waitFor(() => expect(result.current.ruta).not.toBeNull())
    expect(result.current.avance?.restanteM).toBeGreaterThan(0)

    for (const lat of [-33.21, -33.22, -33.23]) rerender({ p: pos(lat, -71.4 + (lat + 33.2) * -0.25) })
    expect(consultasRuta).toHaveLength(1)
  })

  it('no pide nada mientras no hay posición', () => {
    const viaje = viajeEnCurso()
    renderHook(() => useRutaGps(viaje.id, null, true))
    expect(consultasRuta).toHaveLength(0)
  })

  it('un desvío sostenido recalcula, pero no antes del intervalo mínimo', async () => {
    const viaje = viajeEnCurso()
    const { result, rerender } = renderHook(({ p }) => useRutaGps(viaje.id, p, true), { initialProps: { p: SOBRE_LA_RUTA as Posicion | null } })
    await waitFor(() => expect(result.current.ruta).not.toBeNull())

    // lejos de la ruta, varias lecturas seguidas: aún no pasó el intervalo mínimo, no se recalcula
    rerender({ p: LEJOS }); rerender({ p: pos(-33.0, -71.001) }); rerender({ p: pos(-33.0, -71.002) })
    expect(consultasRuta).toHaveLength(1)

    // con el intervalo cumplido, el siguiente desvío sí recalcula
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + INTERVALO_RECALCULO_MS + 1_000)
    rerender({ p: pos(-33.0, -71.003) })
    await waitFor(() => expect(consultasRuta).toHaveLength(2))
  })

  it('un solo salto aislado fuera de la ruta no recalcula', async () => {
    const viaje = viajeEnCurso()
    const { result, rerender } = renderHook(({ p }) => useRutaGps(viaje.id, p, true), { initialProps: { p: SOBRE_LA_RUTA as Posicion | null } })
    await waitFor(() => expect(result.current.ruta).not.toBeNull())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + INTERVALO_RECALCULO_MS + 1_000)
    rerender({ p: LEJOS })
    rerender({ p: SOBRE_LA_RUTA })
    expect(consultasRuta).toHaveLength(1)
  })

  it('el botón recalcula, pero respeta el intervalo mínimo entre pedidos', async () => {
    const viaje = viajeEnCurso()
    const { result } = renderHook(() => useRutaGps(viaje.id, SOBRE_LA_RUTA, true))
    await waitFor(() => expect(result.current.ruta).not.toBeNull())

    act(() => result.current.recalcular())
    expect(consultasRuta).toHaveLength(1)
    expect(result.current.error).toMatch(/espera/i)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + INTERVALO_MANUAL_MS + 1_000)
    act(() => result.current.recalcular())
    await waitFor(() => expect(consultasRuta).toHaveLength(2))
  })

  it('si el servicio de rutas falla informa el error y no reintenta de inmediato', async () => {
    configurarRutaFalsa({ status: 502, error: 'El servicio de rutas no respondió.' })
    const viaje = viajeEnCurso()
    const { result, rerender } = renderHook(({ p }) => useRutaGps(viaje.id, p, true), { initialProps: { p: SOBRE_LA_RUTA } })
    await waitFor(() => expect(result.current.error).toMatch(/no respondió/))
    expect(result.current.ruta).toBeNull()
    rerender({ p: pos(-33.201, -71.4) })
    expect(consultasRuta).toHaveLength(1)
  })

  it('un viaje que no está en el servidor no calcula ruta', () => {
    const { result } = renderHook(() => useRutaGps(undefined, SOBRE_LA_RUTA, true))
    expect(result.current.error).toMatch(/servidor/)
    expect(consultasRuta).toHaveLength(0)
  })
})
