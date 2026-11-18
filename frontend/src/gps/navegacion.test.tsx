import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { numeroDeVan } from '../admin/utils/vanBd'
import { agregarConductor, agregarCuenta, asignarVanBd, agregarViajeBd, configurarRutaFalsa, consultasRuta, CONTRASENA, viajeBdGuardado } from '../test/apiFalsa'

/** GPS-03 a GPS-07 y GPS-08: la pantalla de navegación, con un GPS simulado y el mapa reemplazado por un marcador de prueba. */

// Leaflet necesita medidas reales del navegador; aquí el mapa se sustituye por un texto con lo que recibiría.
vi.mock('./MapaNavegacion', () => ({
  default: (p: { posicion: { lat: number } | null; destino: { nombre: string }; ruta: unknown[] | null }) => (
    <div data-testid="mapa">{`Destino ${p.destino.nombre} · posición ${p.posicion ? 'sí' : 'no'} · ruta ${p.ruta ? p.ruta.length : 0}`}</div>
  ),
}))

const FECHA = '2099-01-04'
const VAN_V1 = numeroDeVan('v1')

type Exito = (p: GeolocationPosition) => void
type Fallo = (e: GeolocationPositionError) => void
let enviar: (lat: number, lon: number) => void
let fallar: (code: number) => void
let clearWatch: ReturnType<typeof vi.fn>
let watchPosition: ReturnType<typeof vi.fn>

beforeEach(() => {
  let exito: Exito = () => {}
  let fallo: Fallo = () => {}
  clearWatch = vi.fn()
  watchPosition = vi.fn((e: Exito, f: Fallo) => { exito = e; fallo = f; return 3 })
  Object.defineProperty(navigator, 'geolocation', { value: { watchPosition, clearWatch }, configurable: true })
  enviar = (lat, lon) => exito({ coords: { latitude: lat, longitude: lon, accuracy: 6 }, timestamp: Date.now() } as GeolocationPosition)
  fallar = (code) => fallo({ code, message: 'x' } as GeolocationPositionError)
  consultasRuta.length = 0
  configurarRutaFalsa({ coordenadas: [[-33.2, -71.4], [-33.435172, -70.634]], distanciaM: 120_000, duracionS: 5_400 })
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'geolocation')
})

const crearConductor = () => {
  const cuenta = agregarCuenta({ nombreCompleto: 'Juan Carrasco', correo: 'dev.conductor@unab.cl', rol: 'conductor', estado: 'aprobada' })
  agregarConductor(cuenta.id)
  // #2905: la administración le asignó la van FG-1251 (id 1); el panel la lee de /api/conductor/perfil
  asignarVanBd('1', cuenta.id)
  return cuenta
}

/** Entra como conductor, abre el viaje indicado y, si está En curso, la navegación desde el botón del detalle. */
const abrirNavegacion = async (idViaje: number) => {
  render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
  await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'dev.conductor@unab.cl')
  await userEvent.type(screen.getByLabelText('Contraseña'), CONTRASENA)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))
  await screen.findByRole('heading', { name: 'Panel del conductor' })
  await waitFor(() => expect(document.querySelector(`a[href="/conductor/viajes/vbd${idViaje}"]`)).not.toBeNull())
  await userEvent.click(document.querySelector<HTMLElement>(`a[href="/conductor/viajes/vbd${idViaje}"]`)!)
}

const irANavegacion = async () => {
  await userEvent.click(await screen.findByRole('link', { name: 'Abrir navegación' }))
  return screen.findByRole('region', { name: 'Progreso del viaje' })
}

describe('GPS-07: acceso a la navegación según el estado del viaje', () => {
  it('un viaje pendiente no ofrece la navegación', async () => {
    const c = crearConductor()
    const v = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id })
    await abrirNavegacion(v.id)
    await screen.findByRole('button', { name: 'Iniciar viaje' })
    expect(screen.queryByRole('link', { name: 'Abrir navegación' })).not.toBeInTheDocument()
  })

  it('abrir la ruta de un viaje que no está en curso muestra un aviso y no activa el GPS', async () => {
    const c = crearConductor()
    const v = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id })
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    await userEvent.type(await screen.findByLabelText('Correo electrónico'), 'dev.conductor@unab.cl')
    await userEvent.type(screen.getByLabelText('Contraseña'), CONTRASENA)
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))
    await screen.findByRole('heading', { name: 'Panel del conductor' })
    // la sesión ya existe: se entra por la dirección de la navegación
    cleanup()
    render(<MemoryRouter initialEntries={[`/conductor/viajes/vbd${v.id}/navegacion`]}><App /></MemoryRouter>)
    expect(await screen.findByText(/solo está disponible mientras el viaje está en curso/)).toBeInTheDocument()
    expect(watchPosition).not.toHaveBeenCalled()
  })
})

describe('GPS-03 a GPS-06: navegación de un viaje en curso', () => {
  const viajeEnCurso = (trayecto: 'Ida' | 'Vuelta') => {
    const c = crearConductor()
    return agregarViajeBd({ fecha: FECHA, trayecto, vanId: VAN_V1, conductorId: c.id, estado: 'en-curso', iniciadoEn: '2099-01-04T09:45:00.000Z' })
  }

  it('la ida tiene como destino la sede de Santiago y no se puede cambiar', async () => {
    const v = viajeEnCurso('Ida')
    await abrirNavegacion(v.id)
    const panel = within(await irANavegacion())
    expect(panel.getByRole('heading', { name: /Santiago · Campus Bellavista/ })).toBeInTheDocument()
    expect(await screen.findByTestId('mapa')).toHaveTextContent('Destino Campus Bellavista')
    expect(panel.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('la vuelta tiene como destino Quillota 980', async () => {
    const v = viajeEnCurso('Vuelta')
    await abrirNavegacion(v.id)
    const panel = within(await irANavegacion())
    expect(panel.getByRole('heading', { name: /Quillota 980 · Campus Viña del Mar/ })).toBeInTheDocument()
  })

  it('con una posición simulada se calcula y muestra la ruta, la distancia y el tiempo restantes', async () => {
    const v = viajeEnCurso('Ida')
    await abrirNavegacion(v.id)
    const panel = within(await irANavegacion())
    act(() => enviar(-33.2, -71.4))
    await waitFor(() => expect(screen.getByTestId('mapa')).toHaveTextContent('ruta 2'))
    expect(consultasRuta).toEqual([{ id: v.id, lat: -33.2, lon: -71.4 }])
    expect(panel.getByText('GPS activo')).toBeInTheDocument()
    expect(panel.getByText(/^\d+,\d km$/)).toBeInTheDocument() // distancia por la ruta, sin el "≈" de la línea recta
    expect(panel.getByText(/h|min/, { selector: 'dd' })).toBeInTheDocument()
  })

  it('el avance se actualiza con cada posición sin pedir otra ruta', async () => {
    const v = viajeEnCurso('Ida')
    await abrirNavegacion(v.id)
    const panel = within(await irANavegacion())
    act(() => enviar(-33.2, -71.4))
    await waitFor(() => expect(consultasRuta).toHaveLength(1))
    const antes = panel.getByText(/^\d+,\d km$/).textContent
    act(() => enviar(-33.3, -71.1))
    await waitFor(() => expect(panel.getByText(/^\d+,\d km$/).textContent).not.toBe(antes))
    expect(consultasRuta).toHaveLength(1)
  })

  it('si no hay señal informa el problema y ofrece reintentar', async () => {
    const v = viajeEnCurso('Ida')
    await abrirNavegacion(v.id)
    const panel = within(await irANavegacion())
    act(() => fallar(2))
    expect(await panel.findByText('Sin señal GPS')).toBeInTheDocument()
    expect(panel.getByRole('alert')).toHaveTextContent(/Sin señal GPS/)
    await userEvent.click(panel.getByRole('button', { name: 'Reintentar ubicación' }))
    expect(watchPosition).toHaveBeenCalledTimes(2)
  })

  it('si se niega el permiso de ubicación lo explica y la pantalla sigue usable', async () => {
    const v = viajeEnCurso('Ida')
    await abrirNavegacion(v.id)
    const panel = within(await irANavegacion())
    act(() => fallar(1))
    expect(await panel.findByText('Ubicación no permitida')).toBeInTheDocument()
    expect(panel.getByRole('alert')).toHaveTextContent(/permiso/)
    expect(panel.getByRole('link', { name: 'Volver al viaje' })).toBeInTheDocument()
    expect(consultasRuta).toHaveLength(0)
  })

  it('si el servicio de rutas falla se avisa, pero la posición sigue en el mapa', async () => {
    configurarRutaFalsa({ status: 503, error: 'El servicio de rutas no está disponible.' })
    const v = viajeEnCurso('Ida')
    await abrirNavegacion(v.id)
    const panel = within(await irANavegacion())
    act(() => enviar(-33.2, -71.4))
    expect(await panel.findByText(/No pudimos calcular la ruta/)).toBeInTheDocument()
    expect(screen.getByTestId('mapa')).toHaveTextContent('posición sí')
  })
})

describe('GPS-07: integración con el ciclo de vida del viaje', () => {
  it('al finalizar el viaje desde la navegación se detiene el GPS y vuelve al detalle como completado', async () => {
    const c = crearConductor()
    const v = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id, estado: 'en-curso', iniciadoEn: '2099-01-04T09:45:00.000Z' })
    await abrirNavegacion(v.id)
    const panel = within(await irANavegacion())
    act(() => enviar(-33.2, -71.4))

    await userEvent.click(panel.getByRole('button', { name: 'Finalizar viaje' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Completar viaje' }))

    await waitFor(() => expect(viajeBdGuardado(v.id)?.estado).toBe('completado'))
    await waitFor(() => expect(clearWatch).toHaveBeenCalledWith(3))
    expect(await screen.findByText('Completado')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Progreso del viaje' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir navegación' })).not.toBeInTheDocument()
  })

  it('volver al viaje no lo finaliza: sigue en curso y el seguimiento se detiene al salir', async () => {
    const c = crearConductor()
    const v = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id, estado: 'en-curso', iniciadoEn: '2099-01-04T09:45:00.000Z' })
    await abrirNavegacion(v.id)
    const panel = within(await irANavegacion())
    await userEvent.click(panel.getByRole('link', { name: 'Volver al viaje' }))
    expect(await screen.findByRole('button', { name: 'Finalizar viaje' })).toBeInTheDocument()
    expect(viajeBdGuardado(v.id)?.estado).toBe('en-curso')
    expect(clearWatch).toHaveBeenCalled()
  })

  it('no interfiere con el historial: el viaje completado sigue ahí', async () => {
    const c = crearConductor()
    const v = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id, estado: 'en-curso', iniciadoEn: '2099-01-04T09:45:00.000Z' })
    await abrirNavegacion(v.id)
    const panel = within(await irANavegacion())
    await userEvent.click(panel.getByRole('button', { name: 'Finalizar viaje' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Completar viaje' }))
    await waitFor(() => expect(viajeBdGuardado(v.id)?.estado).toBe('completado'))
    await userEvent.click(await screen.findByRole('link', { name: /Historial/ }))
    const enHistorial = await waitFor(() => {
      const e = document.querySelector<HTMLElement>(`a[href="/conductor/viajes/vbd${v.id}"]`)
      expect(e).not.toBeNull()
      return e!
    })
    expect(within(enHistorial).getByText('Completado')).toBeInTheDocument()
  })
})
