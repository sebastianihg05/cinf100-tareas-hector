import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { estadoInicial, usarEstadoDePrueba } from '../admin/store/adminStore'
import type { Reserva, Viaje } from '../admin/types'
import { guardarSesion } from '../login/sesion'
import { avisosConductor } from './avisos'
import { asignacionDe } from './viajes'

const CORREO_CONDUCTOR = 'dev.conductor@unab.cl'

// fechas relativas a hoy, para que la prueba no dependa del día en que se corre
const dia = (n: number) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const viaje = (id: string, fecha: string, estado: Viaje['estado'], vanId = 'v1'): Viaje => ({
  id, fecha, hora: '06:45', estado, trayecto: 'Ida', origen: 'Quillota 980', destino: 'Santiago', vanId, reservados: 0,
})

const reserva = (id: string, viajeId: string, asiento: number, estado: Reserva['estado'], creadaEn = `${dia(-1)}T10:00`): Reserva => ({
  id, grupoId: `g-${id}`, pasajeroId: 'p5', viajeId, trayecto: 'Ida', asiento, estado, creadaEn,
})

/** Estado de ejemplo con viajes de la van del conductor (v1) desde hoy en adelante. */
function estadoConAvisos() {
  const base = estadoInicial()
  return {
    ...base,
    viajes: [
      viaje('n1', dia(2), 'pendiente'),
      viaje('n2', dia(3), 'cancelado'),
      viaje('n3', dia(-2), 'pendiente'),
      viaje('n4', dia(2), 'pendiente', 'v2'),
    ],
    reservas: [
      reserva('rn1', 'n1', 4, 'pendiente'),
      reserva('rn2', 'n1', 6, 'cancelada'),
      reserva('rn3', 'n3', 2, 'pendiente'),
      reserva('rn4', 'n4', 1, 'pendiente'),
    ],
  }
}

describe('avisosConductor', () => {
  const estado = estadoConAvisos()
  const avisos = avisosConductor(estado, asignacionDe(estado, CORREO_CONDUCTOR), dia(0))

  it('avisa de sus viajes asignados, reservas nuevas, reservas canceladas y viajes cancelados', () => {
    expect(avisos.map((a) => a.id).sort()).toEqual(
      ['nueva-reserva:rn1', 'reserva-cancelada:rn2', 'viaje-asignado:n1', 'viaje-cancelado:n2'].sort(),
    )
    const nueva = avisos.find((a) => a.id === 'nueva-reserva:rn1')!
    expect(nueva.lineas[0]).toBe('Constanza Silva reservó el asiento #4')
  })

  it('no incluye viajes pasados ni de otras vans', () => {
    expect(avisos.some((a) => a.viajeId === 'n3' || a.viajeId === 'n4')).toBe(false)
  })

  it('ordena del más reciente al más antiguo', () => {
    const fechas = avisos.map((a) => a.fecha)
    expect(fechas).toEqual([...fechas].sort().reverse())
  })

  it('un conductor sin van no tiene avisos', () => {
    expect(avisosConductor(estado, { viajes: [] }, dia(0))).toEqual([])
  })
})

describe('notificaciones en el panel del conductor', () => {
  beforeEach(() => {
    usarEstadoDePrueba(estadoConAvisos())
    guardarSesion({ correo: CORREO_CONDUCTOR, nombre: 'Juan Carrasco', rol: 'conductor', pasajeroId: 'p-conductor' })
  })

  const abrir = (ruta = '/conductor/viajes') => render(<MemoryRouter initialEntries={[ruta]}><App /></MemoryRouter>)

  it('el menú muestra cuántas notificaciones están sin leer y lleva a la vista', async () => {
    abrir()
    const nav = await screen.findByRole('navigation', { name: 'Navegación conductor' })
    await userEvent.click(within(nav).getByRole('link', { name: 'Avisos: 4 sin leer' }))
    expect(await screen.findByRole('heading', { name: 'Notificaciones' })).toBeInTheDocument()
    expect(screen.getByText('4 sin leer')).toBeInTheDocument()
    expect(screen.getAllByText('Nueva')).toHaveLength(4)
  })

  it('cada notificación muestra su fecha, mensaje y estado de lectura', async () => {
    abrir('/conductor/avisos')
    const tarjeta = (await screen.findByText('Nueva reserva')).closest('button')!
    expect(within(tarjeta).getByText('Constanza Silva reservó el asiento #4')).toBeInTheDocument()
    expect(within(tarjeta).getByText(/\d{2}:\d{2}$/)).toBeInTheDocument()
    expect(within(tarjeta).getByText('Nueva')).toBeInTheDocument()
  })

  it('"Marcar todas como leídas" quita el contador y las deja como leídas', async () => {
    abrir('/conductor/avisos')
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar todas como leídas' }))
    expect(screen.getByText('Todas leídas')).toBeInTheDocument()
    expect(screen.getAllByText('Leída')).toHaveLength(4)
    const nav = screen.getByRole('navigation', { name: 'Navegación conductor' })
    expect(within(nav).getByRole('link', { name: 'Avisos' })).toBeInTheDocument()
  })

  it('al tocar una notificación se marca como leída y abre el viaje; volver regresa a las notificaciones', async () => {
    abrir('/conductor/avisos')
    await userEvent.click((await screen.findByText('Viaje cancelado')).closest('button')!)
    expect(await screen.findByRole('heading', { name: 'Detalle del viaje' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Volver a las notificaciones' }))
    expect(await screen.findByText('3 sin leer')).toBeInTheDocument()
  })

  it('sin notificaciones muestra un mensaje', async () => {
    usarEstadoDePrueba({ ...estadoConAvisos(), viajes: [], reservas: [] })
    abrir('/conductor/avisos')
    expect(await screen.findByText('No tienes notificaciones.')).toBeInTheDocument()
  })
})
