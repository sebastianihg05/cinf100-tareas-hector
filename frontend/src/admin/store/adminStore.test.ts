import { describe, expect, it } from 'vitest'
import { estadoInicial, reducer } from './adminStore'

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
