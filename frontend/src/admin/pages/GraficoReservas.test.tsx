import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { estadoInicial } from '../store/adminStore'
import { AdminProvider } from '../store/AdminContext'
import type { Reserva, Viaje } from '../types'
import PanelPendiente from './PanelPendiente'

/**
 * Verificación del gráfico "Reservas por día / por semana" del panel (#1875).
 * Cada prueba guarda un estado propio, con fechas fijas, para que el resultado no dependa del día en que se corran.
 */

const viaje = (id: string, fecha: string, trayecto: Viaje['trayecto'] = 'Ida'): Viaje => ({
  id, fecha, trayecto, hora: trayecto === 'Ida' ? '06:45' : '17:00', vanId: 'v1', estado: 'pendiente', reservados: 0,
  origen: trayecto === 'Ida' ? 'Quillota 980' : 'Santiago', destino: trayecto === 'Ida' ? 'Santiago' : 'Quillota 980',
})

let n = 0
const reserva = (viajeId: string, estado: Reserva['estado'] = 'pendiente'): Reserva => ({
  id: `r${++n}`, grupoId: `g${n}`, pasajeroId: 'p5', viajeId, trayecto: 'Ida', asiento: (n % 8) + 1, estado, creadaEn: '2026-10-01T10:00',
})
const varias = (viajeId: string, cantidad: number, estado: Reserva['estado'] = 'pendiente') =>
  Array.from({ length: cantidad }, () => reserva(viajeId, estado))

const abrirPanel = (viajes: Viaje[], reservas: Reserva[]) => {
  localStorage.setItem('unab-admin-v3', JSON.stringify({ ...estadoInicial(), viajes, reservas }))
  render(<MemoryRouter><AdminProvider><PanelPendiente /></AdminProvider></MemoryRouter>)
}

/** Barras del gráfico: [etiqueta, valor] leídos de su texto accesible ("2 nov: 2. Ver detalle"). */
const barras = (titulo: string) =>
  within(screen.getByRole('region', { name: titulo })).queryAllByRole('link')
    .map((a) => /^(.*): (\d+)\. Ver detalle$/.exec(a.getAttribute('aria-label') ?? '')!.slice(1, 3))

// 2 nov 2026 es lunes: 2 y 4 de noviembre son de una semana; el 10, de la siguiente.
const VIAJES = [viaje('a', '2026-11-02'), viaje('b', '2026-11-04', 'Vuelta'), viaje('c', '2026-11-10')]

describe('Gráfico de reservas por día y por semana', () => {
  it('por día: cuenta las reservas de cada fecha de viaje, de la más antigua a la más nueva', () => {
    abrirPanel(VIAJES, [...varias('c', 3), ...varias('a', 2), ...varias('b', 1)])
    expect(barras('Reservas por día')).toEqual([['2 nov', '2'], ['4 nov', '1'], ['10 nov', '3']])
  })

  it('no cuenta las reservas canceladas, pero sí las completadas', () => {
    abrirPanel(VIAJES, [...varias('a', 2), ...varias('a', 1, 'completada'), ...varias('a', 4, 'cancelada')])
    expect(barras('Reservas por día')).toEqual([['2 nov', '3']])
  })

  it('un viaje con todas sus reservas canceladas no aparece en el gráfico', () => {
    abrirPanel(VIAJES, [...varias('a', 1), ...varias('b', 3, 'cancelada')])
    expect(barras('Reservas por día')).toEqual([['2 nov', '1']])
  })

  it('por semana: suma por semana (desde el lunes) y cambia el título', async () => {
    abrirPanel(VIAJES, [...varias('a', 2), ...varias('b', 1), ...varias('c', 3)])
    await userEvent.click(screen.getByRole('tab', { name: 'Por semana' }))
    expect(screen.queryByRole('region', { name: 'Reservas por día' })).not.toBeInTheDocument()
    expect(barras('Reservas por semana')).toEqual([['Semana del 2 nov', '3'], ['Semana del 9 nov', '3']])
  })

  it('se puede volver a "Por día" y el gráfico recupera sus barras', async () => {
    abrirPanel(VIAJES, varias('a', 2))
    await userEvent.click(screen.getByRole('tab', { name: 'Por semana' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Por día' }))
    expect(barras('Reservas por día')).toEqual([['2 nov', '2']])
  })

  it('el largo de cada barra es proporcional al valor máximo', () => {
    abrirPanel(VIAJES, [...varias('a', 2), ...varias('b', 1), ...varias('c', 4)])
    const region = screen.getByRole('region', { name: 'Reservas por día' })
    const anchos = [...region.querySelectorAll<HTMLElement>('.grafico-barras__relleno')].map((e) => Number.parseFloat(e.style.width))
    expect(anchos[2]).toBe(100)
    expect(anchos[0]).toBeCloseTo(50, 5)
    expect(anchos[1]).toBeCloseTo(25, 5)
  })

  it('muestra solo las últimas 7 fechas', () => {
    const dias = Array.from({ length: 9 }, (_, i) => `2026-11-0${i + 1}`)
    abrirPanel(dias.map((d, i) => viaje(`d${i}`, d)), dias.flatMap((_, i) => varias(`d${i}`, 1)))
    const etiquetas = barras('Reservas por día').map(([e]) => e)
    expect(etiquetas).toEqual(['3 nov', '4 nov', '5 nov', '6 nov', '7 nov', '8 nov', '9 nov'])
  })

  it('sin reservas muestra el mensaje en vez de barras', () => {
    abrirPanel(VIAJES, [])
    const region = screen.getByRole('region', { name: 'Reservas por día' })
    expect(within(region).getByText('Aún no hay reservas.')).toBeInTheDocument()
    expect(within(region).queryAllByRole('link')).toHaveLength(0)
  })
})
