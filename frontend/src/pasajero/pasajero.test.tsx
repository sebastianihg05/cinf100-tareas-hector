import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { reservasIniciales, pasajerosIniciales, vansIniciales, viajesIniciales } from '../admin/data/mock'
import { agruparReservas, asientosOcupados, cancelables, sincronizar, validarSolicitud, type Datos } from '../admin/store/reservas'
import { guardarSesion } from '../login/sesion'
import { disponerAsientos } from './MapaAsientos'

const datos = (): Datos =>
  sincronizar({ vans: vansIniciales, viajes: viajesIniciales, pasajeros: pasajerosIniciales, reservas: reservasIniciales })

describe('disponerAsientos', () => {
  it('con 8 asientos replica el diseño: [C,1] [2,3] [4,5] [6,7,8]', () => {
    expect(disponerAsientos(8)).toEqual([['conductor', 1], [2, 3], [4, 5], [6, 7, 8]])
  })
  it('cubre todas las capacidades sin perder ni repetir asientos', () => {
    for (let n = 1; n <= 14; n++) {
      const asientos = disponerAsientos(n).flat().filter((c): c is number => c !== 'conductor')
      expect(asientos).toEqual(Array.from({ length: n }, (_, i) => i + 1))
    }
    expect(disponerAsientos(0)).toEqual([])
  })
})

describe('reglas de reserva', () => {
  it('rechaza un asiento ocupado y uno inexistente', () => {
    const d = datos()
    const viaje = d.viajes.find((v) => v.id === 'f2i')!
    const ocupado = asientosOcupados(d.reservas, viaje.id)[0]
    const c1 = validarSolicitud(d, 'p5', [{ viajeId: viaje.id, trayecto: 'Ida', asiento: ocupado }])
    expect(c1[0].codigo).toBe('asiento-ocupado')
    const c2 = validarSolicitud(d, 'p5', [{ viajeId: viaje.id, trayecto: 'Ida', asiento: 99 }])
    expect(c2[0].codigo).toBe('asiento-invalido')
  })
  it('acepta un asiento libre y rechaza reservar dos veces el mismo viaje', () => {
    const d = datos()
    expect(validarSolicitud(d, 'p5', [{ viajeId: 'f2i', trayecto: 'Ida', asiento: 1 }])).toEqual([])
    const dup = validarSolicitud(d, 'p5', [{ viajeId: 'f1i', trayecto: 'Ida', asiento: 1 }])
    expect(dup[0].codigo).toBe('reserva-duplicada')
  })
  it('rechaza viajes que no están pendientes', () => {
    const c = validarSolicitud(datos(), 'p5', [{ viajeId: 't6', trayecto: 'Ida', asiento: 1 }])
    expect(c[0].codigo).toBe('viaje-no-disponible')
  })
  it('solo se pueden cancelar las reservas propias, pendientes y de viajes que aún no salen', () => {
    const d = datos()
    const { proximas, historial } = agruparReservas(d, 'p5')
    const grupo = proximas[0]
    expect(cancelables(d, 'p5', grupo.grupoId).length).toBeGreaterThan(0)
    // otra persona no puede cancelar reservas ajenas
    expect(cancelables(d, 'p2', grupo.grupoId)).toEqual([])
    // lo que ya está en el historial (completado o cancelado) no se puede cancelar
    for (const g of historial) expect(cancelables(d, 'p5', g.grupoId)).toEqual([])
  })

  it('agrupa Próximas e Historial de la pasajera', () => {
    const { proximas, historial } = agruparReservas(datos(), PASAJERO_ID)
    expect(proximas.every((g) => g.estado === 'pendiente')).toBe(true)
    expect(proximas.length).toBeGreaterThan(0)
    expect(historial.map((g) => g.estado)).toEqual(expect.arrayContaining(['completada', 'cancelada']))
  })
})

const PASAJERO_ID = 'p5'

describe('flujo del pasajero', () => {
  // la app del pasajero exige haber iniciado sesión: se entra como la funcionaria de ejemplo
  beforeEach(() => guardarSesion({ correo: 'S.constanza@uandresbello.edu', nombre: 'Constanza Silva', rol: 'funcionario', pasajeroId: PASAJERO_ID }))

  it('reserva ida y vuelta y la ve en Mis Reservas, compartida con el administrador', async () => {
    render(<MemoryRouter initialEntries={['/pasajero/reservar']}><App /></MemoryRouter>)

    // el desplegable de fechas parte con la primera fecha disponible (14 oct.: la del 8 oct. ya está reservada)
    const fecha = screen.getByLabelText(/Fecha del Viaje/) as HTMLSelectElement
    const opciones = within(fecha).getAllByRole('option')
    await userEvent.selectOptions(fecha, opciones[0])
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar asientos' }))

    expect(await screen.findByText('Selección Asiento — Ida')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Asiento 2' }))
    expect(screen.getByText('Asiento seleccionado: 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar Asiento Ida' }))

    expect(await screen.findByText('Selección Asiento - Vuelta')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Asiento 4' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar Asiento Vuelta' }))

    expect(await screen.findByText('¡Reserva Confirmada!')).toBeInTheDocument()
    const guardado = JSON.parse(localStorage.getItem('unab-admin-v3')!)
    const mias = guardado.reservas.filter((r: { pasajeroId: string; estado: string }) => r.pasajeroId === PASAJERO_ID && r.estado === 'pendiente')
    expect(mias.length).toBe(4)
  })

  it('un asiento ocupado no se puede elegir', async () => {
    render(<MemoryRouter initialEntries={['/pasajero/reservar']}><App /></MemoryRouter>)
    const fecha = screen.getByLabelText(/Fecha del Viaje/) as HTMLSelectElement
    const opciones = within(fecha).getAllByRole('option')
    await userEvent.selectOptions(fecha, opciones[0])
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar asientos' }))
    await screen.findByText('Selección Asiento — Ida')
    expect(screen.getAllByRole('radio', { name: /ocupado/ }).every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
  })

  it('Mis Reservas muestra Próximas e Historial', async () => {
    render(<MemoryRouter initialEntries={['/pasajero/reservas']}><App /></MemoryRouter>)
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
  })

  it('la sede de origen es fija: solo Quillota 980', () => {
    render(<MemoryRouter initialEntries={['/pasajero/reservar']}><App /></MemoryRouter>)
    const origen = screen.getByLabelText('Sede de Origen') as HTMLInputElement
    expect(origen.value).toBe('Quillota 980')
    expect(origen.readOnly).toBe(true)
    expect(screen.queryByRole('option', { name: 'Quintay' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Rokamar' })).not.toBeInTheDocument()
  })

  it('el cliente puede cancelar su reserva: pide confirmación, libera el asiento y pasa al historial', async () => {
    render(<MemoryRouter initialEntries={['/pasajero/reservas']}><App /></MemoryRouter>)
    const antes = screen.getAllByRole('button', { name: 'Cancelar reserva' }).length

    await userEvent.click(screen.getAllByRole('button', { name: 'Cancelar reserva' })[0])
    const dialogo = screen.getByRole('dialog')
    // "Volver" no cancela nada
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Volver' }))
    expect(screen.getAllByRole('button', { name: 'Cancelar reserva' })).toHaveLength(antes)

    await userEvent.click(screen.getAllByRole('button', { name: 'Cancelar reserva' })[0])
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar reserva' }))

    expect(screen.getByRole('status')).toHaveTextContent('Tu reserva fue cancelada')
    expect(screen.queryAllByRole('button', { name: 'Cancelar reserva' })).toHaveLength(antes - 1)

    // el asiento quedó libre en lo guardado y la reserva figura como cancelada
    const guardado = JSON.parse(localStorage.getItem('unab-admin-v3')!)
    const canceladas = guardado.reservas.filter((r: { pasajeroId: string; estado: string }) => r.pasajeroId === PASAJERO_ID && r.estado === 'cancelada')
    expect(canceladas.length).toBeGreaterThan(0)
  })

  it('las reservas del historial no tienen botón para cancelar', async () => {
    render(<MemoryRouter initialEntries={['/pasajero/reservas']}><App /></MemoryRouter>)
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument()
  })
})
