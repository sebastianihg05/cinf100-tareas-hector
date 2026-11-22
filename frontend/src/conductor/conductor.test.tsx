import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { choferesIniciales, vansIniciales, viajesIniciales } from '../admin/data/mock'
import type { Viaje } from '../admin/types'
import { guardarSesion, leerSesion } from '../login/sesion'
import { asignacionDe, esProximo, separarViajes } from './viajes'

const datos = { choferes: choferesIniciales, vans: vansIniciales, viajes: viajesIniciales }
const CORREO_CONDUCTOR = 'dev.conductor@unab.cl'

const viaje = (id: string, fecha: string, hora: string, estado: Viaje['estado']): Viaje => ({
  id, fecha, hora, estado, trayecto: 'Ida', origen: 'Quillota 980', destino: 'Santiago', vanId: 'v1', reservados: 0,
})

describe('asignacionDe', () => {
  it('relaciona correo -> chofer -> van -> viajes de esa van', () => {
    const a = asignacionDe(datos, CORREO_CONDUCTOR)
    expect(a.chofer?.id).toBe('c1')
    expect(a.van?.id).toBe('v1')
    expect(a.viajes.length).toBeGreaterThan(0)
    expect(a.viajes.every((v) => v.vanId === 'v1')).toBe(true)
  })

  it('no distingue mayúsculas ni espacios en el correo', () => {
    expect(asignacionDe(datos, ` ${CORREO_CONDUCTOR.toUpperCase()} `).chofer?.id).toBe('c1')
  })

  it('un correo que no es de ningún chofer no tiene van ni viajes', () => {
    expect(asignacionDe(datos, 'otro@unab.cl')).toEqual({ chofer: undefined, van: undefined, viajes: [] })
  })

  it('un chofer dado de baja o sin van no ve viajes', () => {
    const baja = { ...datos, choferes: datos.choferes.map((c) => (c.id === 'c1' ? { ...c, activo: false } : c)) }
    expect(asignacionDe(baja, CORREO_CONDUCTOR).viajes).toEqual([])
    const sinVan = { ...datos, vans: datos.vans.map((v) => (v.id === 'v1' ? { ...v, choferId: null } : v)) }
    const a = asignacionDe(sinVan, CORREO_CONDUCTOR)
    expect(a.chofer?.id).toBe('c1')
    expect(a.van).toBeUndefined()
    expect(a.viajes).toEqual([])
  })
})

describe('separarViajes', () => {
  // fechas relativas a hoy, para que la prueba no dependa del día en que se corre
  const dia = (n: number) => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const lista = [
    viaje('a', dia(1), '17:00', 'pendiente'),
    viaje('b', dia(1), '06:45', 'pendiente'),
    viaje('c', dia(-3), '06:45', 'en-curso'),
    viaje('d', dia(-30), '06:45', 'completado'),
    viaje('e', dia(-20), '17:00', 'cancelado'),
    viaje('f', dia(-5), '06:45', 'pendiente'),
    viaje('g', dia(0), '06:45', 'pendiente'),
  ]

  it('próximos: en curso y pendientes desde hoy, el más cercano primero', () => {
    expect(separarViajes(lista).proximos.map((v) => v.id)).toEqual(['c', 'g', 'b', 'a'])
    expect(lista.filter(esProximo)).toHaveLength(4)
  })

  it('un viaje pendiente de un día que ya pasó no aparece como próximo ni en el historial', () => {
    const { proximos, historial } = separarViajes(lista)
    expect(proximos.some((v) => v.id === 'f')).toBe(false)
    expect(historial.some((v) => v.id === 'f')).toBe(false)
  })

  it('historial: completados y cancelados, el más reciente primero', () => {
    expect(separarViajes(lista).historial.map((v) => v.id)).toEqual(['e', 'd'])
  })
})

describe('panel del conductor', () => {
  beforeEach(() => guardarSesion({ correo: CORREO_CONDUCTOR, nombre: 'Juan Carrasco', rol: 'conductor', pasajeroId: 'p-conductor' }))

  const abrir = (ruta = '/conductor') => render(<MemoryRouter initialEntries={[ruta]}><App /></MemoryRouter>)

  it('/conductor lleva al listado de viajes con su saludo y su van', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Panel del conductor' })).toBeInTheDocument()
    expect(screen.getByText('Hola, Juan')).toBeInTheDocument()
    expect(screen.getByText(/Van FG-1251/)).toBeInTheDocument()
  })

  it('lista solo los viajes de su van, con ruta, hora y asientos reservados', async () => {
    abrir('/conductor/viajes')
    const panel = await screen.findByRole('tabpanel')
    const tarjetas = within(panel).getAllByRole('listitem')
    const esperados = asignacionDe(datos, CORREO_CONDUCTOR).viajes.filter(esProximo)
    expect(tarjetas).toHaveLength(esperados.length)
    // la primera tarjeta es el viaje más cercano (no depende de la fecha en que se corran las pruebas)
    const primero = esperados[0]
    expect(within(tarjetas[0]).getByText(`${primero.trayecto}: ${primero.origen} → ${primero.destino}`)).toBeInTheDocument()
    expect(within(tarjetas[0]).getByText(`${primero.hora} hrs`)).toBeInTheDocument()
    expect(within(tarjetas[0]).getByText(/^Asientos reservados: \d+\/9$/)).toBeInTheDocument()
    expect(within(tarjetas[0]).getByText('Pendiente')).toBeInTheDocument()
    // un viaje de otra van (f1... rota v1/v2/v3) no aparece
    const otraVan = viajesIniciales.find((v) => v.vanId === 'v2' && esProximo(v))!
    expect(esperados.some((v) => v.id === otraVan.id)).toBe(false)
  })

  it('el historial muestra los viajes completados y cancelados', async () => {
    abrir('/conductor/viajes')
    await userEvent.click(await screen.findByRole('tab', { name: 'Anteriores' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getAllByText('Completado').length).toBeGreaterThan(0)
    expect(within(panel).getAllByText('Cancelado').length).toBeGreaterThan(0)
    expect(within(panel).queryByText('Pendiente')).not.toBeInTheDocument()
  })

  it('la navegación inferior lleva al perfil, donde se puede cerrar sesión', async () => {
    abrir('/conductor/viajes')
    const nav = await screen.findByRole('navigation', { name: 'Navegación conductor' })
    await userEvent.click(within(nav).getByRole('link', { name: /Perfil/ }))
    expect(await screen.findByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument()
  })

  it('un correo sin registro de chofer ve un aviso en vez del listado', async () => {
    guardarSesion({ correo: 'sin.registro@unab.cl', nombre: 'Camila Torres', rol: 'conductor', pasajeroId: 'bd9' })
    abrir('/conductor/viajes')
    expect(await screen.findByText(/no está registrado como chofer/)).toBeInTheDocument()
    expect(screen.getByText('Sin van asignada')).toBeInTheDocument()
  })

  it('un funcionario no entra al panel del conductor: va a su pantalla de inicio', async () => {
    guardarSesion({ correo: 'S.constanza@uandresbello.edu', nombre: 'Constanza Silva', rol: 'funcionario', pasajeroId: 'p5' })
    abrir('/conductor/viajes')
    expect(await screen.findByRole('heading', { name: 'Reservar Asiento' })).toBeInTheDocument()
    expect(leerSesion()?.rol).toBe('funcionario')
  })

  it('sin sesión se vuelve al inicio de sesión', async () => {
    sessionStorage.clear()
    abrir('/conductor/viajes')
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})
