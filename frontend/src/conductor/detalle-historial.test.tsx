import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { choferesIniciales, pasajerosIniciales, reservasIniciales, vansIniciales, viajesIniciales } from '../admin/data/mock'
import { estadoInicial } from '../admin/store/adminStore'
import type { Reserva, Viaje } from '../admin/types'
import { guardarSesion } from '../login/sesion'
import { asignacionDe, pasajerosDelViaje, trayectosDelDia, viajeAsignado, viajesFinalizados } from './viajes'

const CORREO = 'dev.conductor@unab.cl'
const asignacion = () => asignacionDe({ choferes: choferesIniciales, vans: vansIniciales, viajes: viajesIniciales }, CORREO)

const reserva = (id: string, viajeId: string, asiento: number, estado: Reserva['estado'] = 'pendiente', pasajeroId = 'p5'): Reserva => ({
  id, grupoId: `g-${id}`, pasajeroId, viajeId, trayecto: 'Ida', asiento, estado, creadaEn: '2026-09-29T10:00',
})

const viaje = (id: string, fecha: string, hora: string, estado: Viaje['estado'], vanId = 'v1'): Viaje => ({
  id, fecha, hora, estado, vanId, trayecto: hora < '12:00' ? 'Ida' : 'Vuelta', origen: 'Quillota 980', destino: 'Santiago', reservados: 0,
})

describe('lógica del detalle y del historial', () => {
  it('viajeAsignado solo entrega viajes de la van del conductor', () => {
    const a = asignacion()
    expect(viajeAsignado(a, 'f1i')?.vanId).toBe('v1')
    expect(viajeAsignado(a, 'f2i')).toBeUndefined() // es de la van v2
    expect(viajeAsignado(a, 'no-existe')).toBeUndefined()
    expect(viajeAsignado(a, undefined)).toBeUndefined()
  })

  it('pasajerosDelViaje ordena por asiento y deja fuera las reservas canceladas', () => {
    const reservas = [
      reserva('a', 'x', 6, 'pendiente', 'p2'),
      reserva('b', 'x', 2, 'completada', 'p3'),
      reserva('c', 'x', 4, 'cancelada', 'p4'),
      reserva('d', 'otro', 1),
    ]
    const lista = pasajerosDelViaje({ reservas, pasajeros: pasajerosIniciales }, 'x')
    expect(lista.map((p) => [p.asiento, p.nombre])).toEqual([[2, 'Sebastian Hidalgo'], [6, 'Bruno Urrutia']])
  })

  it('un pasajero que ya no existe aparece como "Pasajero no encontrado"', () => {
    const lista = pasajerosDelViaje({ reservas: [reserva('a', 'x', 1, 'pendiente', 'borrado')], pasajeros: pasajerosIniciales }, 'x')
    expect(lista[0].nombre).toBe('Pasajero no encontrado')
  })

  it('trayectosDelDia entrega los viajes de la van ese día, ordenados por hora', () => {
    const viajes = [
      viaje('v', '2026-11-04', '17:00', 'pendiente'),
      viaje('i', '2026-11-04', '06:45', 'pendiente'),
      viaje('otro-dia', '2026-11-05', '06:45', 'pendiente'),
    ]
    const a = { viajes, chofer: undefined, van: undefined }
    expect(trayectosDelDia(a, viajes[0]).map((t) => t.id)).toEqual(['i', 'v'])
    expect(trayectosDelDia(a, viajes[2]).map((t) => t.id)).toEqual(['otro-dia'])
  })

  it('viajesFinalizados deja solo los completados, el más reciente primero', () => {
    const viajes = [
      viaje('a', '2026-10-01', '06:45', 'completado'),
      viaje('b', '2026-10-05', '17:00', 'completado'),
      viaje('c', '2026-10-03', '06:45', 'cancelado'),
      viaje('d', '2026-10-09', '06:45', 'pendiente'),
      viaje('e', '2026-10-05', '06:45', 'completado'),
    ]
    expect(viajesFinalizados(viajes).map((v) => v.id)).toEqual(['b', 'e', 'a'])
  })
})

describe('detalle del viaje', () => {
  beforeEach(() => guardarSesion({ correo: CORREO, nombre: 'Juan Carrasco', rol: 'conductor', pasajeroId: 'p-conductor' }))

  const abrir = (ruta: string) => render(<MemoryRouter initialEntries={[ruta]}><App /></MemoryRouter>)

  /** Estado guardado con reservas adicionales, para probar viajes con varios pasajeros. */
  const conReservas = (extra: Reserva[]) =>
    localStorage.setItem('unab-admin-v3', JSON.stringify({ ...estadoInicial(), reservas: [...reservasIniciales, ...extra] }))

  it('muestra el resumen del viaje: ruta, estado, hora, van y asientos reservados', async () => {
    abrir('/conductor/viajes/f1i')
    expect(await screen.findByRole('heading', { name: 'Detalle del viaje' })).toBeInTheDocument()
    const resumen = screen.getByRole('region', { name: 'Resumen del viaje' })
    expect(within(resumen).getByText('Ida: Quillota 980 → Santiago')).toBeInTheDocument()
    expect(within(resumen).getByText('Pendiente')).toBeInTheDocument()
    expect(within(resumen).getByText('06:45 hrs')).toBeInTheDocument()
    expect(within(resumen).getByText('FG-1251')).toBeInTheDocument()
    expect(within(resumen).getByText('1/9')).toBeInTheDocument()
  })

  it('lista los pasajeros con su asiento, ordenados por número de asiento', async () => {
    conReservas([reserva('x1', 'f1i', 8, 'pendiente', 'p3'), reserva('x2', 'f1i', 1, 'pendiente', 'p2')])
    abrir('/conductor/viajes/f1i')
    const seccion = await screen.findByRole('region', { name: 'Pasajeros del viaje' })
    expect(within(seccion).getByRole('heading', { name: 'Pasajeros (3)' })).toBeInTheDocument()
    const filas = within(within(seccion).getByRole('list', { name: 'Pasajeros y asientos' })).getAllByRole('listitem')
    const nombre = (li: HTMLElement) => li.querySelector('.cnd-pasajero__nombre')?.textContent
    expect(filas.map((li) => `${li.querySelector('.cnd-pasajero__asiento')?.textContent}${nombre(li)}`))
      .toEqual(['1Bruno Urrutia', '3Constanza Silva', '8Sebastian Hidalgo'])
  })

  it('un viaje sin pasajeros lo indica con un mensaje', async () => {
    abrir('/conductor/viajes/f4i') // sin reservas en los datos de ejemplo
    const seccion = await screen.findByRole('region', { name: 'Pasajeros del viaje' })
    expect(within(seccion).getByRole('heading', { name: 'Pasajeros (0)' })).toBeInTheDocument()
    expect(within(seccion).getByText('Este viaje no tiene pasajeros con reserva vigente.')).toBeInTheDocument()
    expect(within(seccion).queryByRole('list')).not.toBeInTheDocument()
  })

  it('una reserva cancelada no aparece entre los pasajeros', async () => {
    abrir('/conductor/viajes/t6') // viaje cancelado cuya única reserva está cancelada
    expect(await screen.findByText('Este viaje no tiene pasajeros con reserva vigente.')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Resumen del viaje' })).getByText('Cancelado')).toBeInTheDocument()
  })

  it('muestra los trayectos del día y permite pasar del de ida al de vuelta', async () => {
    abrir('/conductor/viajes/f1i')
    const dia = await screen.findByRole('region', { name: 'Trayectos del día' })
    const items = within(within(dia).getByRole('list', { name: 'Trayectos del día' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Este viaje')).toBeInTheDocument()
    expect(within(items[1]).getByText(/17:00 hrs · 1 pasajero/)).toBeInTheDocument()

    await userEvent.click(within(dia).getByRole('link', { name: 'Ver el trayecto de Vuelta de las 17:00' }))
    expect(await screen.findByText('Vuelta: Santiago → Quillota 980')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Pasajeros del viaje' })).getByText('Constanza Silva')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Pasajeros del viaje' })).getByLabelText('Asiento 5')).toBeInTheDocument()
  })

  it('cuando el día tiene un solo trayecto, lo indica', async () => {
    abrir('/conductor/viajes/t1')
    expect(await screen.findByText('Este es el único trayecto que tienes asignado ese día.')).toBeInTheDocument()
  })

  it('un viaje de otra van o inexistente no se puede ver', async () => {
    abrir('/conductor/viajes/f2i')
    expect(await screen.findByText('No encontramos este viaje entre los que tienes asignados.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Resumen del viaje' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a mis viajes' })).toHaveAttribute('href', '/conductor/viajes')
  })

  it('conserva la pestaña Historial al abrir un viaje desde Mis viajes y regresar', async () => {
    abrir('/conductor/viajes')
    await userEvent.click(await screen.findByRole('tab', { name: 'Historial' }))
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true')

    const panel = screen.getByRole('tabpanel')
    await userEvent.click(within(panel).getAllByRole('link')[0])
    expect(await screen.findByRole('heading', { name: 'Detalle del viaje' })).toBeInTheDocument()
    const volver = screen.getByRole('link', { name: 'Volver a mis viajes' })
    expect(volver).toHaveAttribute('href', '/conductor/viajes?tab=historial')
    await userEvent.click(volver)

    expect(await screen.findByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('tabpanel')).queryByText('Pendiente')).not.toBeInTheDocument()
  })

  it('desde el listado, tocar una tarjeta abre su detalle y la flecha vuelve al listado', async () => {
    abrir('/conductor/viajes')
    const panel = await screen.findByRole('tabpanel')
    await userEvent.click(within(panel).getAllByRole('link')[0])
    expect(await screen.findByRole('heading', { name: 'Detalle del viaje' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Volver a mis viajes' }))
    expect(await screen.findByRole('heading', { name: 'Panel del conductor' })).toBeInTheDocument()
  })
})

describe('historial de viajes finalizados', () => {
  beforeEach(() => guardarSesion({ correo: CORREO, nombre: 'Juan Carrasco', rol: 'conductor', pasajeroId: 'p-conductor' }))

  const abrir = (ruta = '/conductor/historial') => render(<MemoryRouter initialEntries={[ruta]}><App /></MemoryRouter>)

  it('lista solo los viajes completados de su van, con los pasajeros transportados', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Historial de viajes' })).toBeInTheDocument()
    expect(screen.getByText('1 viaje finalizado')).toBeInTheDocument()
    const tarjetas = screen.getAllByRole('listitem')
    expect(tarjetas).toHaveLength(1)
    expect(within(tarjetas[0]).getByText('Completado')).toBeInTheDocument()
    expect(within(tarjetas[0]).getByText('Ida: Quillota 980 → Santiago')).toBeInTheDocument()
    expect(within(tarjetas[0]).getByText('Van FG-1251')).toBeInTheDocument()
    expect(within(tarjetas[0]).getByText('Pasajeros transportados: 1')).toBeInTheDocument()
    // ni pendientes ni cancelados ni viajes de otra van
    expect(screen.queryByText('Pendiente')).not.toBeInTheDocument()
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument()
  })

  it('sin viajes finalizados muestra un estado vacío', async () => {
    localStorage.setItem('unab-admin-v3', JSON.stringify({ ...estadoInicial(), viajes: viajesIniciales.filter((v) => v.estado !== 'completado') }))
    abrir()
    expect(await screen.findByText('Aún no tienes viajes finalizados.')).toBeInTheDocument()
  })

  it('un correo sin registro de chofer ve el aviso', async () => {
    guardarSesion({ correo: 'sin.registro@unab.cl', nombre: 'Camila Torres', rol: 'conductor', pasajeroId: 'bd9' })
    abrir()
    expect(await screen.findByText(/no está registrado como chofer/)).toBeInTheDocument()
  })

  it('abre el detalle de un viaje finalizado y la flecha vuelve al historial', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('link', { name: /Ver el detalle del viaje/ }))
    expect(await screen.findByRole('heading', { name: 'Detalle del viaje' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Resumen del viaje' })).getByText('Completado')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Pasajeros del viaje' })).getByText('Constanza Silva')).toBeInTheDocument()
    // desde el historial, la pestaña marcada sigue siendo "Historial"
    expect(screen.getByRole('link', { name: /Historial/ })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(screen.getByRole('link', { name: 'Volver al historial' }))
    expect(await screen.findByRole('heading', { name: 'Historial de viajes' })).toBeInTheDocument()
  })

  it('conserva el regreso al historial tras cambiar entre trayectos del día', async () => {
    // Fuerza una ida y vuelta completadas en el mismo día, sin tocar el resto del estado.
    const viajes = viajesIniciales.map((v) =>
      v.id === 'f1i' || v.id === 'f1v' ? { ...v, estado: 'completado' as const } : v,
    )
    localStorage.setItem('unab-admin-v3', JSON.stringify({ ...estadoInicial(), viajes }))
    abrir()

    const enlaceIda = screen.getAllByRole('link', { name: /Ver el detalle del viaje/ })
      .find((l) => l.getAttribute('href') === '/conductor/viajes/f1i')
    expect(enlaceIda).toBeDefined()
    await userEvent.click(enlaceIda!)
    expect(await screen.findByRole('heading', { name: 'Detalle del viaje' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Ver el trayecto de Vuelta de las 17:00' }))
    expect(await screen.findByText('Vuelta: Santiago → Quillota 980')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al historial' })).toHaveAttribute('href', '/conductor/historial')
  })

  it('la navegación tiene Mis viajes, Historial, Avisos y Perfil, y marca la activa', async () => {
    abrir()
    const nav = await screen.findByRole('navigation', { name: 'Navegación conductor' })
    // "Avisos" puede llevar delante el contador de no leídas
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Mis viajes', 'Historial', expect.stringMatching(/Avisos$/), 'Perfil'])
    expect(within(nav).getByRole('link', { name: 'Historial' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(within(nav).getByRole('link', { name: 'Mis viajes' }))
    expect(await screen.findByRole('heading', { name: 'Panel del conductor' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Mis viajes' })).toHaveAttribute('aria-current', 'page')
  })
})
