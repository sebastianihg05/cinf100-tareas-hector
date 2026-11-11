import { describe, expect, it } from 'vitest'
import { cargarEstado, estadoInicial, reducer, sinViajesPasados } from './adminStore'

describe('sinViajesPasados', () => {
  it('borra los viajes de días anteriores con sus reservas y avisos, y deja los de hoy en adelante', () => {
    const antes = {
      ...estadoInicial(),
      notificaciones: [{ id: 'n1', tipo: 'viaje-iniciado' as const, viajeId: 't5', fecha: '2026-10-07T17:00', leida: false }],
    }
    const hoy = '2026-11-01'
    const despues = sinViajesPasados(antes, hoy)

    expect(despues.viajes.length).toBeGreaterThan(0)
    expect(despues.viajes.every((v) => v.fecha >= hoy)).toBe(true)
    expect(despues.viajes).toEqual(expect.arrayContaining(antes.viajes.filter((v) => v.fecha >= hoy).map((v) => expect.objectContaining({ id: v.id }))))
    const ids = new Set(despues.viajes.map((v) => v.id))
    expect(despues.reservas.every((r) => ids.has(r.viajeId))).toBe(true)
    expect(despues.reservas.length).toBeLessThan(antes.reservas.length)
    expect(despues.notificaciones).toEqual([])
    // vans, choferes y cuentas no se tocan
    expect(despues.vans).toEqual(antes.vans)
    expect(despues.choferes).toEqual(antes.choferes)
    expect(despues.pasajeros.map((p) => p.id)).toEqual(antes.pasajeros.map((p) => p.id))
  })

  it('si no hay viajes pasados, no cambia nada', () => {
    const s = estadoInicial()
    expect(sinViajesPasados(s, '2000-01-01')).toBe(s)
  })
})

describe('pasajero/eliminar', () => {
  it('borra la cuenta y todas sus reservas, y libera los cupos de sus viajes', () => {
    const antes = estadoInicial()
    const reservasDeP5 = antes.reservas.filter((r) => r.pasajeroId === 'p5')
    expect(reservasDeP5.length).toBeGreaterThan(0)

    const despues = reducer(antes, { type: 'pasajero/eliminar', id: 'p5' })

    expect(despues.pasajeros.some((p) => p.id === 'p5')).toBe(false)
    expect(despues.reservas.some((r) => r.pasajeroId === 'p5')).toBe(false)

    // cada viaje que tenía reservas activas de p5 queda con menos asientos tomados
    for (const r of reservasDeP5.filter((x) => x.estado !== 'cancelada')) {
      const viajeAntes = antes.viajes.find((v) => v.id === r.viajeId)!
      const viajeDespues = despues.viajes.find((v) => v.id === r.viajeId)!
      expect(viajeDespues.reservados).toBeLessThan(viajeAntes.reservados)
    }
  })

  it('no toca a las demás personas ni sus reservas', () => {
    const antes = estadoInicial()
    const despues = reducer(antes, { type: 'pasajero/eliminar', id: 'p5' })
    expect(despues.pasajeros).toHaveLength(antes.pasajeros.length - 1)
    expect(despues.reservas.filter((r) => r.pasajeroId === 'p2')).toEqual(antes.reservas.filter((r) => r.pasajeroId === 'p2'))
  })

  it('eliminar una cuenta que no existe no cambia nada', () => {
    const antes = estadoInicial()
    const despues = reducer(antes, { type: 'pasajero/eliminar', id: 'no-existe' })
    expect(despues.pasajeros).toEqual(antes.pasajeros)
    expect(despues.reservas).toEqual(antes.reservas)
  })
})

describe('capacidad de las vans', () => {
  it('las vans de ejemplo tienen 9 asientos (Hyundai Staria)', () => {
    expect(estadoInicial().vans.every((v) => v.asientos === 9)).toBe(true)
  })

  it('un estado guardado con la capacidad antigua (8) se corrige a 9 al cargarlo', () => {
    const viejo = { ...estadoInicial(), vans: estadoInicial().vans.map((v) => ({ ...v, asientos: 8 })) }
    localStorage.setItem('unab-admin-v3', JSON.stringify(viejo))
    expect(cargarEstado().vans.every((v) => v.asientos === 9)).toBe(true)
  })
})
