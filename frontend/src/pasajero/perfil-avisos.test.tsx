import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import type { MiTrayectoBd } from '../api'
import { sumarDias, todayISO } from '../admin/utils/format'
import { guardarSesion, leerSesion } from '../login/sesion'
import { agregarReservaBd, agregarViajeBd } from '../test/apiFalsa'
import { avisosDe } from './avisos'

const abrir = (ruta: string) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  )

beforeEach(() =>
  guardarSesion({ correo: 'S.constanza@uandresbello.edu', nombre: 'Constanza Silva', rol: 'funcionario', pasajeroId: 'p5' }))

/** Trayecto de GET /api/reservas para las pruebas: una ida pendiente en 3 días. */
const trayecto = (cambios: Partial<MiTrayectoBd> = {}): MiTrayectoBd => ({
  id: 1, viajeId: 1, trayecto: 'Ida', fecha: sumarDias(todayISO(), 3), hora: '06:45', origen: 'Quillota 980', destino: 'Santiago',
  asiento: 2, estado: 'pendiente', estadoViaje: 'pendiente', editable: true, capacidad: 9, ocupados: [],
  creadaEn: '2026-11-01T10:00:00.000Z', ...cambios,
})

describe('avisos del funcionario', () => {
  it('avisa de cada reserva suya que sigue por viajar, con la ida y la vuelta juntas', () => {
    const avisos = avisosDe([{ grupoId: 'g1', reservas: [trayecto(), trayecto({ id: 2, trayecto: 'Vuelta', asiento: 5 })] }])
    expect(avisos.map((a) => a.titulo)).toEqual(['Reserva confirmada'])
    expect(avisos[0].lineas[1]).toBe('Asiento #2 (Ida) / Asiento #5 (Vuelta)')
    // sin reservas no hay avisos
    expect(avisosDe([])).toEqual([])
  })

  it('avisa cuando el conductor inicia un viaje que reservó', () => {
    const avisos = avisosDe([{ grupoId: 'g1', reservas: [trayecto({ estadoViaje: 'en-curso', editable: false })] }])
    expect(avisos.map((a) => a.titulo)).toContain('Tu viaje está en curso')
  })

  it('avisa cuando la administración cancela un viaje que reservó, pero no si canceló él mismo', () => {
    const porAdministracion = trayecto({ estado: 'cancelada', estadoViaje: 'cancelado', editable: false })
    expect(avisosDe([{ grupoId: 'g1', reservas: [porAdministracion] }]).map((a) => a.titulo)).toEqual(['Viaje cancelado por la administración'])
    const propia = trayecto({ estado: 'cancelada', editable: false })
    expect(avisosDe([{ grupoId: 'g2', reservas: [propia] }])).toEqual([])
  })
})

describe('campana de notificaciones del funcionario', () => {
  // S3-RES-04 (#2608): los avisos salen de las reservas en la base; Constanza es la cuenta 2 del backend falso.
  beforeEach(() => {
    guardarSesion({ ...leerSesion()!, token: 'token-2' })
    const viaje = agregarViajeBd({ fecha: sumarDias(todayISO(), 3), vanId: 1 })
    agregarReservaBd(viaje.id, { usuarioId: 2, asiento: 4 })
  })

  it('abre un panel con sus avisos, muestra cuántos no ha leído y los marca como leídos', async () => {
    abrir('/pasajero/reservas')
    const campana = await screen.findByRole('button', { name: 'Notificaciones: 1 sin leer' })
    await userEvent.click(campana)

    const panel = screen.getByRole('dialog', { name: 'Notificaciones' })
    expect(within(panel).getAllByText('Reserva confirmada').length).toBeGreaterThan(0)

    await userEvent.click(within(panel).getByRole('button', { name: 'Marcar como leídas' }))
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument() // ya no hay sin leer
  })

  it('tocar un aviso lo marca como leído y lleva a Mis Reservas', async () => {
    abrir('/pasajero/reservar')
    await userEvent.click(await screen.findByRole('button', { name: /^Notificaciones: 1 sin leer/ }))
    const panel = screen.getByRole('dialog', { name: 'Notificaciones' })
    await userEvent.click(within(panel).getAllByRole('button', { name: /Reserva confirmada/ })[0])
    expect(screen.getByRole('heading', { name: 'Mis Reservas' })).toBeInTheDocument()
  })

  it('lo leído se recuerda: al volver a entrar no reaparece como nuevo', async () => {
    const primera = abrir('/pasajero/reservas')
    await userEvent.click(await screen.findByRole('button', { name: /^Notificaciones: 1 sin leer/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Marcar como leídas' }))
    primera.unmount()

    abrir('/pasajero/reservas')
    await screen.findByText('Pendiente')
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument()
  })
})

describe('perfil del funcionario', () => {
  it('se entra desde la tarjeta de saludo y desde la pestaña Perfil', async () => {
    abrir('/pasajero/reservar')
    expect(screen.getByRole('link', { name: 'Perfil' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Ir a mi perfil' }))
    expect(screen.getByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Constanza Silva' })).toBeInTheDocument()
    expect(screen.getByText('Quillota 980 (Campus Viña del Mar)')).toBeInTheDocument()
    expect(screen.queryByText('Apariencia')).not.toBeInTheDocument() // solo tema claro
  })

  it('puede editar su celular', async () => {
    abrir('/pasajero/perfil')
    await userEvent.click(screen.getByRole('button', { name: /Editar/ }))
    const campo = screen.getByLabelText('Celular')
    await userEvent.clear(campo)
    await userEvent.type(campo, '987654321')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText('+56 9 8765 4321')).toBeInTheDocument()
  })

  it('cerrar sesión borra la sesión y vuelve al login', async () => {
    abrir('/pasajero/perfil')
    await userEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }))
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(leerSesion()).toBeNull()
  })
})

describe('Mis Reservas: botón de editar', () => {
  it('cada reserva que se puede cancelar muestra también el botón "Editar reserva"', async () => {
    // S3-RES-04 (#2608): las reservas vienen de la base; Constanza es la cuenta 2 del backend falso.
    guardarSesion({ ...leerSesion()!, token: 'token-2' })
    for (const dias of [3, 4]) {
      const viaje = agregarViajeBd({ fecha: sumarDias(todayISO(), dias), vanId: 1 })
      agregarReservaBd(viaje.id, { usuarioId: 2, asiento: 1 })
    }
    abrir('/pasajero/reservas')
    const editar = await screen.findAllByRole('button', { name: 'Editar reserva' })
    expect(editar).toHaveLength(2)
    expect(editar.length).toBeGreaterThan(0)
    expect(editar).toHaveLength(screen.getAllByRole('button', { name: 'Cancelar reserva' }).length)
  })
})
