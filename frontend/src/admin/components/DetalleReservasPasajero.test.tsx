import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { pasajerosIniciales, reservasIniciales, viajesIniciales } from '../data/mock'
import VistaPasajeros from '../pages/VistaPasajeros'
import { AdminProvider } from '../store/AdminContext'
import { agruparReservas } from '../store/reservas'
import DetalleReservasPasajero from './DetalleReservasPasajero'

const abrirPasajeros = () =>
  render(<MemoryRouter><AdminProvider><VistaPasajeros /></AdminProvider></MemoryRouter>)

const CONSTANZA = pasajerosIniciales.find((p) => p.id === 'p5')!

/** Abre "Ver reservas" de Constanza Silva, que tiene una reserva próxima, una completada y una cancelada. */
const verReservasDeConstanza = async () => {
  abrirPasajeros()
  await userEvent.click(screen.getByRole('button', { name: 'Ver reservas de Constanza Silva' }))
  return screen.getByRole('dialog', { name: 'Constanza Silva' })
}

describe('HU-16 Detalle de reservas de un pasajero (administrador)', () => {
  it('cada pasajero aprobado tiene su acceso "Ver reservas" en el listado', () => {
    abrirPasajeros()
    for (const p of pasajerosIniciales.filter((x) => x.aprobado)) {
      expect(screen.getByRole('button', { name: `Ver reservas de ${p.nombre}` })).toBeInTheDocument()
    }
  })

  it('también se llega desde el detalle del pasajero con "Ver todas sus reservas"', async () => {
    abrirPasajeros()
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle de Constanza Silva' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver todas sus reservas' }))
    expect(screen.getByRole('region', { name: 'Reservas de Constanza Silva' })).toBeInTheDocument()
  })

  it('muestra su correo, el total de reservas y las separa en próximas e historial', async () => {
    const dialogo = await verReservasDeConstanza()
    const detalle = within(dialogo).getByRole('region', { name: 'Reservas de Constanza Silva' })
    expect(within(detalle).getByText(CONSTANZA.email)).toBeInTheDocument()
    expect(within(detalle).getByText('3 reservas registradas')).toBeInTheDocument()
    expect(within(detalle).getByRole('heading', { name: 'Próximas (1)' })).toBeInTheDocument()
    expect(within(detalle).getByRole('heading', { name: 'Historial (2)' })).toBeInTheDocument()
  })

  it('cada trayecto muestra su ruta, hora de salida, asiento y estado', async () => {
    const dialogo = await verReservasDeConstanza()
    const proximas = within(dialogo).getByRole('region', { name: 'Reservas próximas' })
    const trayectos = within(proximas).getAllByRole('listitem').filter((li) => li.className.includes('adm-reservas__trayecto'))
    expect(trayectos).toHaveLength(2)

    const [ida, vuelta] = trayectos
    expect(within(ida).getByText('Ida')).toBeInTheDocument()
    expect(within(ida).getByText('Quillota 980 → Santiago')).toBeInTheDocument()
    expect(within(ida).getByText('06:45 h')).toBeInTheDocument()
    expect(within(ida).getByText('3')).toBeInTheDocument()
    expect(within(ida).getAllByText('Pendiente').length).toBeGreaterThan(0)

    expect(within(vuelta).getByText('Santiago → Quillota 980')).toBeInTheDocument()
    expect(within(vuelta).getByText('17:00 h')).toBeInTheDocument()
    expect(within(vuelta).getByText('5')).toBeInTheDocument()
  })

  it('el historial incluye las reservas completadas y las canceladas', async () => {
    const dialogo = await verReservasDeConstanza()
    const historial = within(dialogo).getByRole('region', { name: 'Historial de reservas' })
    expect(within(historial).getAllByText('Completada').length).toBeGreaterThan(0)
    expect(within(historial).getAllByText('Cancelada').length).toBeGreaterThan(0)
    expect(within(historial).queryByText('Pendiente')).not.toBeInTheDocument()
  })

  it('es solo de consulta: no ofrece cancelar, editar ni eliminar', async () => {
    const dialogo = await verReservasDeConstanza()
    const botones = within(dialogo).getAllByRole('button').map((b) => b.textContent?.trim() || b.getAttribute('aria-label'))
    expect(botones).toEqual(['Cerrar', '← Volver al perfil'])
  })

  it('"Volver al perfil" regresa al detalle del pasajero', async () => {
    const dialogo = await verReservasDeConstanza()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Volver al perfil' }))
    expect(screen.getByRole('button', { name: 'Ver todas sus reservas' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Reservas de Constanza Silva' })).not.toBeInTheDocument()
  })
})

describe('DetalleReservasPasajero (componente)', () => {
  const datos = { viajes: viajesIniciales, reservas: reservasIniciales }

  it('un pasajero sin reservas muestra el mensaje y no las secciones', () => {
    render(<DetalleReservasPasajero pasajero={CONSTANZA} proximas={[]} historial={[]} onVolver={() => {}} />)
    expect(screen.getByText('0 reservas registradas')).toBeInTheDocument()
    expect(screen.getByText('Este pasajero no tiene reservas registradas.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Reservas próximas' })).not.toBeInTheDocument()
  })

  it('con una sola reserva usa el singular', () => {
    const { proximas, historial } = agruparReservas(datos, 'p5')
    render(<DetalleReservasPasajero pasajero={CONSTANZA} proximas={proximas.slice(0, 1)} historial={[]} onVolver={() => {}} />)
    expect(screen.getByText('1 reserva registrada')).toBeInTheDocument()
    expect(screen.getByText('No hay reservas en el historial.')).toBeInTheDocument()
    expect(historial.length).toBe(2)
  })

  it('si falta el viaje de una reserva, lo indica en vez de fallar', () => {
    const { proximas } = agruparReservas({ viajes: [], reservas: reservasIniciales }, 'p5', '2000-01-01')
    const grupos = agruparReservas({ viajes: [], reservas: reservasIniciales }, 'p5')
    render(<DetalleReservasPasajero pasajero={CONSTANZA} proximas={[]} historial={[...proximas, ...grupos.historial]} onVolver={() => {}} />)
    expect(screen.getAllByText('Viaje no disponible').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Fecha no disponible').length).toBeGreaterThan(0)
  })

  it('el botón "Volver al perfil" avisa al componente padre', async () => {
    const onVolver = vi.fn()
    render(<DetalleReservasPasajero pasajero={CONSTANZA} proximas={[]} historial={[]} onVolver={onVolver} />)
    await userEvent.click(screen.getByRole('button', { name: 'Volver al perfil' }))
    expect(onVolver).toHaveBeenCalledTimes(1)
  })
})
