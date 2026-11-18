import { describe, expect, it } from 'vitest'
import { guardarSesion } from '../../login/sesion'
import { cargarEstado, estadoInicial, reducer } from './adminStore'

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

})

// #2905: el estado de la app vive solo en memoria y no se lee ni se guarda en el navegador.
describe('estado inicial sin localStorage', () => {
  it('no lee lo que haya quedado guardado en el navegador de versiones anteriores', () => {
    localStorage.setItem('unab-admin-v3', JSON.stringify({ ...estadoInicial(), pasajeros: [] }))
    expect(cargarEstado().pasajeros).toEqual(estadoInicial().pasajeros)
  })

  it('con sesión del servidor parte vacío: todo llega desde la API', () => {
    guardarSesion({ correo: 'dev.admin@unab.cl', nombre: 'Administrador Desarrollo', rol: 'admin', pasajeroId: null, token: 'token-1' })
    const s = cargarEstado()
    expect([s.vans, s.choferes, s.pasajeros, s.viajes, s.reservas, s.notificaciones]).toEqual([[], [], [], [], [], []])
    expect(s.admin).toMatchObject({ nombre: 'Administrador Desarrollo', email: 'dev.admin@unab.cl' })
  })

  it('sin sesión del servidor (pruebas y demostración) usa los datos de ejemplo', () => {
    expect(cargarEstado().pasajeros.length).toBeGreaterThan(0)
  })
})
