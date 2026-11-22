import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { reservasIniciales, pasajerosIniciales, vansIniciales, viajesIniciales } from '../admin/data/mock'
import { agruparReservas, asientosOcupados, cancelables, sincronizar, validarCambioAsientos, validarSolicitud, type Datos } from '../admin/store/reservas'
import { sumarDias, todayISO } from '../admin/utils/format'
import { guardarSesion } from '../login/sesion'
import { agregarReservaBd, agregarViajeBd, viajeBdGuardado } from '../test/apiFalsa'
import MapaAsientos, { disponerAsientos } from './MapaAsientos'
import { DURACION_AVISO_MS } from './pages/MisReservas'

const datos = (): Datos =>
  sincronizar({ vans: vansIniciales, viajes: viajesIniciales, pasajeros: pasajerosIniciales, reservas: reservasIniciales })

describe('disponerAsientos', () => {
  it('con 9 asientos replica la Hyundai Staria: [conductor, copiloto] [1,2] [3,4] [5,6] [7,8,9]', () => {
    expect(disponerAsientos(9)).toEqual([['conductor', 'copiloto'], [1, 2], [3, 4], [5, 6], [7, 8, 9]])
  })
  it('cubre todas las capacidades sin perder ni repetir asientos', () => {
    for (let n = 1; n <= 14; n++) {
      const asientos = disponerAsientos(n).flat().filter((c): c is number => c !== 'conductor' && c !== 'copiloto')
      expect(asientos).toEqual(Array.from({ length: n }, (_, i) => i + 1))
    }
    expect(disponerAsientos(0)).toEqual([])
  })
})

describe('mapa de asientos de la Hyundai Staria', () => {
  it('muestra 9 asientos reservables y el del copiloto no se puede elegir', () => {
    const elegidos: number[] = []
    render(<MapaAsientos capacidad={9} ocupados={[]} onSeleccionar={(n) => elegidos.push(n)} />)
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Asiento ${n}`))
    const copiloto = screen.getByRole('img', { name: 'Asiento del copiloto, no disponible' })
    expect(copiloto).not.toHaveAttribute('role', 'radio')
    expect(elegidos).toEqual([])
    expect(screen.getByRole('img', { name: 'Conductor' })).toBeInTheDocument()
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

describe('validarCambioAsientos', () => {
  it('acepta un asiento libre y rechaza uno ocupado o inexistente', () => {
    const d = datos()
    const ida = d.reservas.find((r) => r.grupoId === 'g-prox' && r.trayecto === 'Ida')!
    expect(validarCambioAsientos(d, PASAJERO_ID, 'g-prox', [{ id: ida.id, asiento: 1 }])).toEqual([])
    expect(validarCambioAsientos(d, PASAJERO_ID, 'g-prox', [{ id: ida.id, asiento: 99 }])[0].codigo).toBe('asiento-invalido')

    const otra = { ...ida, id: 'x1', pasajeroId: 'p2', grupoId: 'g-otra', asiento: 6 }
    const conOtra = { ...d, reservas: [...d.reservas, otra] }
    expect(validarCambioAsientos(conOtra, PASAJERO_ID, 'g-prox', [{ id: ida.id, asiento: 6 }])[0].codigo).toBe('asiento-ocupado')
  })

  it('no deja editar una reserva del historial', () => {
    const d = datos()
    const hist = d.reservas.find((r) => r.grupoId === 'g-hist')!
    expect(validarCambioAsientos(d, PASAJERO_ID, 'g-hist', [{ id: hist.id, asiento: 4 }])[0].codigo).toBe('viaje-no-disponible')
  })
})

describe('flujo del pasajero', () => {
  // S3-RES-04 (#2608): el panel lee y guarda en la base (aquí, el backend falso de src/test/apiFalsa.ts).
  // Constanza Silva es la cuenta 2 del backend falso y "p5" en los datos locales.
  beforeEach(() => guardarSesion({
    correo: 'S.constanza@uandresbello.edu', nombre: 'Constanza Silva', rol: 'funcionario', pasajeroId: PASAJERO_ID, token: 'token-2',
  }))

  const ID_CONSTANZA = 2
  const OTRA_PERSONA = 99

  // Ida y vuelta abiertas en 3 días, con la van asignada.
  const idaYVuelta = () => {
    const fecha = sumarDias(todayISO(), 3)
    return { ida: agregarViajeBd({ fecha, trayecto: 'Ida', vanId: 1 }), vuelta: agregarViajeBd({ fecha, trayecto: 'Vuelta', vanId: 1 }) }
  }

  const abrirReservar = async () => {
    render(<MemoryRouter initialEntries={['/pasajero/reservar']}><App /></MemoryRouter>)
    const boton = await screen.findByRole('button', { name: 'Seleccionar asientos' })
    await waitFor(() => expect(boton).toBeEnabled())
    return boton
  }

  it('reserva ida y vuelta y queda guardada en la base, no en el navegador', async () => {
    const { ida, vuelta } = idaYVuelta()
    await userEvent.click(await abrirReservar())

    expect(await screen.findByText('Selección Asiento — Ida')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('radio', { name: 'Asiento 2' }))
    expect(screen.getByText('Asiento seleccionado: 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar Asiento Ida' }))

    expect(await screen.findByText('Selección Asiento - Vuelta')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('radio', { name: 'Asiento 4' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar Asiento Vuelta' }))

    expect(await screen.findByText('¡Reserva Confirmada!')).toBeInTheDocument()
    expect(screen.getByText('Asiento #2')).toBeInTheDocument()
    expect(screen.getByText('Asiento #4')).toBeInTheDocument()

    const enIda = viajeBdGuardado(ida.id)!.reservas
    const enVuelta = viajeBdGuardado(vuelta.id)!.reservas
    expect(enIda.map((r) => [r.usuarioId, r.asiento])).toEqual([[ID_CONSTANZA, 2]])
    expect(enVuelta.map((r) => [r.usuarioId, r.asiento])).toEqual([[ID_CONSTANZA, 4]])
    expect(enIda[0].grupoId).toBe(enVuelta[0].grupoId)
  })

  it('un asiento ocupado en la base no se puede elegir', async () => {
    const { ida } = idaYVuelta()
    agregarReservaBd(ida.id, { usuarioId: OTRA_PERSONA, asiento: 3 })
    await userEvent.click(await abrirReservar())
    await screen.findByText('Selección Asiento — Ida')
    expect(await screen.findByRole('radio', { name: 'Asiento 3, ocupado' })).toBeDisabled()
    expect(screen.getAllByRole('radio', { name: /ocupado/ })).toHaveLength(1)
  })

  it('si otra persona toma el asiento antes de confirmar, avisa y lo muestra ocupado', async () => {
    const { ida } = idaYVuelta()
    await abrirReservar()
    await userEvent.click(screen.getByRole('button', { name: 'Ida' }))
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar asientos' }))
    await userEvent.click(await screen.findByRole('radio', { name: 'Asiento 5' }))

    agregarReservaBd(ida.id, { usuarioId: OTRA_PERSONA, asiento: 5 })
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar Asiento Ida' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('reservado por otra persona')
    expect(await screen.findByRole('radio', { name: 'Asiento 5, ocupado' })).toBeDisabled()
    expect(viajeBdGuardado(ida.id)!.reservas.filter((r) => r.usuarioId === ID_CONSTANZA)).toEqual([])
  })

  it('no ofrece viajes en los que ya tiene reserva', async () => {
    const { ida, vuelta } = idaYVuelta()
    agregarReservaBd(ida.id, { usuarioId: ID_CONSTANZA, asiento: 1 })
    agregarReservaBd(vuelta.id, { usuarioId: ID_CONSTANZA, asiento: 1 })
    render(<MemoryRouter initialEntries={['/pasajero/reservar']}><App /></MemoryRouter>)
    expect(await screen.findByText(/No hay viajes disponibles desde Quillota 980/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionar asientos' })).toBeDisabled()
  })

  // Una reserva por viajar, una completada y una cancelada, como las devuelve GET /api/reservas.
  const reservasDeConstanza = () => {
    const { ida, vuelta } = idaYVuelta()
    const proxima = agregarReservaBd(ida.id, { usuarioId: ID_CONSTANZA, asiento: 2 })
    agregarReservaBd(vuelta.id, { usuarioId: ID_CONSTANZA, asiento: 3, grupoId: proxima.grupoId })
    const pasado = agregarViajeBd({ fecha: sumarDias(todayISO(), -5), estado: 'completado', vanId: 1 })
    agregarReservaBd(pasado.id, { usuarioId: ID_CONSTANZA, asiento: 6, estado: 'completada' })
    const anulado = agregarViajeBd({ fecha: sumarDias(todayISO(), -3), estado: 'cancelado', vanId: 1 })
    agregarReservaBd(anulado.id, { usuarioId: ID_CONSTANZA, asiento: 7, estado: 'cancelada' })
    return { ida, proxima }
  }

  it('Mis Reservas muestra Próximas e Historial desde la base', async () => {
    reservasDeConstanza()
    render(<MemoryRouter initialEntries={['/pasajero/reservas']}><App /></MemoryRouter>)
    expect(await screen.findByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText('Asientos: #2 (Ida) / #3 (Vuelta)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
  })

  it('la sede de origen es fija: solo Quillota 980 (Campus Viña del Mar)', async () => {
    render(<MemoryRouter initialEntries={['/pasajero/reservar']}><App /></MemoryRouter>)
    const origen = await screen.findByLabelText('Sede de Origen') as HTMLInputElement
    expect(origen.value).toBe('Quillota 980 (Campus Viña del Mar)')
    expect(origen.readOnly).toBe(true)
    expect(screen.queryByRole('option', { name: 'Quintay' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Rokamar' })).not.toBeInTheDocument()
  })

  it('la fecha se elige entre 1 y 30 días desde hoy', async () => {
    render(<MemoryRouter initialEntries={['/pasajero/reservar']}><App /></MemoryRouter>)
    const fecha = await screen.findByLabelText(/Fecha del Viaje/) as HTMLInputElement
    expect(fecha.type).toBe('date')
    expect(fecha.min).toBe(sumarDias(todayISO(), 1))
    expect(fecha.max).toBe(sumarDias(todayISO(), 30))
  })

  it('una fecha fuera del rango o sin viajes no deja continuar', async () => {
    idaYVuelta()
    await abrirReservar()
    const fecha = screen.getByLabelText(/Fecha del Viaje/)
    fireEvent.change(fecha, { target: { value: sumarDias(todayISO(), 45) } })
    expect(screen.getByRole('alert')).toHaveTextContent('entre 1 y 30 días')
    expect(screen.getByRole('button', { name: 'Seleccionar asientos' })).toBeDisabled()

    // otro día dentro del rango, sin viaje abierto
    fireEvent.change(fecha, { target: { value: sumarDias(todayISO(), 10) } })
    expect(screen.getByRole('status')).toHaveTextContent('No hay viajes disponibles desde Quillota 980')
    expect(screen.getByRole('button', { name: 'Seleccionar asientos' })).toBeDisabled()
  })

  it('editar una reserva cambia el asiento en la base', async () => {
    const { ida, proxima } = reservasDeConstanza()
    render(<MemoryRouter initialEntries={['/pasajero/reservas']}><App /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar reserva' }))
    const dialogo = screen.getByRole('dialog')
    await userEvent.click(within(dialogo).getAllByRole('radio', { name: 'Asiento 1' })[0])
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText(/Tu reserva fue actualizada/)).toBeInTheDocument()
    expect(viajeBdGuardado(ida.id)!.reservas.find((r) => r.id === proxima.id)!.asiento).toBe(1)
    expect(await screen.findByText('Asientos: #1 (Ida) / #3 (Vuelta)')).toBeInTheDocument()
  })

  it('#2901: el aviso "Tu reserva fue actualizada" se oculta solo después de unos segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      reservasDeConstanza()
      render(<MemoryRouter initialEntries={['/pasajero/reservas']}><App /></MemoryRouter>)
      await usuario.click(await screen.findByRole('button', { name: 'Editar reserva' }))
      const dialogo = screen.getByRole('dialog')
      await usuario.click(within(dialogo).getAllByRole('radio', { name: 'Asiento 1' })[0])
      await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }))
      expect(await screen.findByText(/Tu reserva fue actualizada/)).toBeInTheDocument()

      // todavía se ve justo antes de cumplir el tiempo
      act(() => { vi.advanceTimersByTime(DURACION_AVISO_MS - 500) })
      expect(screen.getByText(/Tu reserva fue actualizada/)).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(500) })
      expect(screen.queryByText(/Tu reserva fue actualizada/)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('el cliente puede cancelar su reserva: pide confirmación, libera el asiento y pasa al historial', async () => {
    const { ida, proxima } = reservasDeConstanza()
    render(<MemoryRouter initialEntries={['/pasajero/reservas']}><App /></MemoryRouter>)

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar reserva' }))
    // "Volver" no cancela nada
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Volver' }))
    expect(screen.getAllByRole('button', { name: 'Cancelar reserva' })).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar reserva' }))

    expect(await screen.findByText(/Tu reserva fue cancelada/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Cancelar reserva' })).toHaveLength(0))
    expect(viajeBdGuardado(ida.id)!.reservas.find((r) => r.id === proxima.id)!.estado).toBe('cancelada')
  })

  it('las reservas del historial no tienen botón para cancelar', async () => {
    reservasDeConstanza()
    render(<MemoryRouter initialEntries={['/pasajero/reservas']}><App /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('tab', { name: 'Historial' }))
    await screen.findByText('Completado')
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument()
  })
})
