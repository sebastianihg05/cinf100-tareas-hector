import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { estadoInicial, reducer } from '../admin/store/adminStore'
import { agruparReservas } from '../admin/store/reservas'
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

/** id del primer viaje que la funcionaria p5 tiene pendiente */
const viajeDeP5 = () => agruparReservas(estadoInicial(), 'p5').proximas[0].trayectos[0].reserva.viajeId

describe('avisos del funcionario', () => {
  it('avisa de cada reserva suya que sigue por viajar', () => {
    const avisos = avisosDe(estadoInicial(), 'p5')
    expect(avisos.map((a) => a.titulo)).toContain('Reserva confirmada')
    // los datos de ejemplo incluyen además un viaje cancelado por la administración; no hay otros tipos
    expect(avisos.every((a) => ['Reserva confirmada', 'Viaje cancelado por la administración'].includes(a.titulo))).toBe(true)
    // alguien sin reservas no recibe avisos (y no ve los de otras personas)
    expect(avisosDe(estadoInicial(), 'p1')).toEqual([])
  })

  it('avisa cuando el conductor inicia un viaje que reservó', () => {
    const estado = reducer(estadoInicial(), { type: 'viaje/estado', id: viajeDeP5(), estado: 'en-curso' })
    expect(avisosDe(estado, 'p5').map((a) => a.titulo)).toContain('Tu viaje está en curso')
  })

  it('avisa cuando la administración cancela un viaje que reservó', () => {
    const estado = reducer(estadoInicial(), { type: 'viaje/estado', id: viajeDeP5(), estado: 'cancelado' })
    expect(avisosDe(estado, 'p5').map((a) => a.titulo)).toContain('Viaje cancelado por la administración')
  })
})

describe('campana de notificaciones del funcionario', () => {
  it('abre un panel con sus avisos, muestra cuántos no ha leído y los marca como leídos', async () => {
    abrir('/pasajero/reservas')
    const campana = screen.getByRole('button', { name: /^Notificaciones: \d+ sin leer/ })
    await userEvent.click(campana)

    const panel = screen.getByRole('dialog', { name: 'Notificaciones' })
    expect(within(panel).getAllByText('Reserva confirmada').length).toBeGreaterThan(0)

    await userEvent.click(within(panel).getByRole('button', { name: 'Marcar como leídas' }))
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument() // ya no hay sin leer
  })

  it('tocar un aviso lo marca como leído y lleva a Mis Reservas', async () => {
    abrir('/pasajero/reservar')
    await userEvent.click(screen.getByRole('button', { name: /^Notificaciones/ }))
    const panel = screen.getByRole('dialog', { name: 'Notificaciones' })
    await userEvent.click(within(panel).getAllByRole('button', { name: /Reserva confirmada/ })[0])
    expect(screen.getByRole('heading', { name: 'Mis Reservas' })).toBeInTheDocument()
  })

  it('lo leído se recuerda: al volver a entrar no reaparece como nuevo', async () => {
    const primera = abrir('/pasajero/reservas')
    await userEvent.click(screen.getByRole('button', { name: /^Notificaciones/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Marcar como leídas' }))
    primera.unmount()

    abrir('/pasajero/reservas')
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
