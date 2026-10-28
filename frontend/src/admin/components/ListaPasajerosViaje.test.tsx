import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { pasajerosIniciales, reservasIniciales, viajesIniciales } from '../data/mock'
import VistaViajes from '../pages/VistaViajes'
import { AdminProvider } from '../store/AdminContext'
import { fechaDMY } from '../utils/format'

const abrirViajes = () =>
  render(<MemoryRouter><AdminProvider><VistaViajes /></AdminProvider></MemoryRouter>)

const nombre = (id: string) => pasajerosIniciales.find((p) => p.id === id)!.nombre
const correo = (id: string) => pasajerosIniciales.find((p) => p.id === id)!.email

/** Tarjeta de un viaje en el listado (fecha, hora y ruta lo identifican). */
const tarjeta = (viajeId: string) => {
  const v = viajesIniciales.find((x) => x.id === viajeId)!
  return screen.getAllByRole('listitem').find((li) => {
    const t = li.textContent ?? ''
    return t.includes(`${v.origen} → ${v.destino}`) && t.includes(fechaDMY(v.fecha)) && t.includes(`${v.hora} hrs`)
  })!
}

const verPasajeros = async (viajeId: string) => {
  await userEvent.click(within(tarjeta(viajeId)).getByRole('button', { name: /^Ver pasajeros/ }))
  return screen.getByRole('dialog')
}

/** Filas del listado: [asiento, estado, pasajero, correo] */
const filas = (dialogo: HTMLElement) =>
  within(within(dialogo).getByRole('list', { name: 'Pasajeros y asientos' })).getAllByRole('listitem').map((li) => [
    li.querySelector('strong')?.textContent,
    li.querySelector('.adm-reservas__estado')?.textContent,
    ...[...li.querySelectorAll('dd')].map((dd) => dd.textContent),
  ])

describe('HU-19 Pasajeros de cada viaje con su asiento', () => {
  it('cada viaje del listado tiene su acceso a "Ver pasajeros"', () => {
    abrirViajes()
    const tarjetas = screen.getAllByRole('listitem').filter((li) => li.classList.contains('adm-card--trip'))
    expect(tarjetas.length).toBe(viajesIniciales.length)
    for (const t of tarjetas) expect(within(t).getByRole('button', { name: /^Ver pasajeros/ })).toBeInTheDocument()
  })

  it('el botón indica cuántas reservas activas tiene el viaje', () => {
    abrirViajes()
    expect(within(tarjeta('t5')).getByRole('button', { name: 'Ver pasajeros (3)' })).toBeInTheDocument()
    expect(within(tarjeta('t6')).getByRole('button', { name: 'Ver pasajeros (0)' })).toBeInTheDocument()
  })

  it('muestra solo los pasajeros del viaje elegido, cada uno con su asiento', async () => {
    abrirViajes()
    const dialogo = await verPasajeros('t5')

    expect(filas(dialogo)).toEqual([
      ['Asiento 1', 'Pendiente', nombre('p3'), correo('p3')],
      ['Asiento 5', 'Pendiente', nombre('p4'), correo('p4')],
      ['Asiento 6', 'Pendiente', nombre('p2'), correo('p2')],
    ])
    expect(within(dialogo).queryByText(nombre('p5'))).not.toBeInTheDocument()
    expect(within(dialogo).getByText('3 pasajeros con reserva activa')).toBeInTheDocument()
  })

  it('al abrir otro viaje, muestra solo los pasajeros de ese viaje', async () => {
    abrirViajes()
    await verPasajeros('t5')
    await userEvent.keyboard('{Escape}')
    const dialogo = await verPasajeros('t2')

    expect(filas(dialogo)).toEqual([['Asiento 2', 'Pendiente', nombre('p4'), correo('p4')]])
    expect(within(dialogo).queryByText(nombre('p2'))).not.toBeInTheDocument()
  })

  it('con varios pasajeros, ordena por asiento y respeta el trayecto de ida y de vuelta', async () => {
    abrirViajes()
    let dialogo = await verPasajeros('f2i')
    expect(filas(dialogo).map(([asiento]) => asiento)).toEqual(['Asiento 3', 'Asiento 6', 'Asiento 8'])
    expect(within(dialogo).getByText(/· Ida$/)).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    dialogo = await verPasajeros('f2v')
    expect(filas(dialogo).map(([asiento]) => asiento)).toEqual(['Asiento 3', 'Asiento 6', 'Asiento 8'])
    expect(within(dialogo).getByText(/· Vuelta$/)).toBeInTheDocument()
  })

  it('un viaje sin reservas lo indica y no muestra pasajeros', async () => {
    const sinReservas = viajesIniciales.find((v) => !reservasIniciales.some((r) => r.viajeId === v.id))!
    abrirViajes()
    const dialogo = await verPasajeros(sinReservas.id)

    expect(within(dialogo).getByText('Este viaje todavía no tiene reservas.')).toBeInTheDocument()
    expect(within(dialogo).queryByRole('list', { name: 'Pasajeros y asientos' })).not.toBeInTheDocument()
    expect(within(dialogo).getByText('0 pasajeros con reserva activa')).toBeInTheDocument()
  })

  it('una reserva cancelada aparece como Cancelada y no cuenta como activa', async () => {
    abrirViajes()
    const dialogo = await verPasajeros('t6')

    expect(filas(dialogo)).toEqual([['Asiento 3', 'Cancelada', nombre('p5'), correo('p5')]])
    expect(within(dialogo).getByText('0 pasajeros con reserva activa')).toBeInTheDocument()
  })
})
