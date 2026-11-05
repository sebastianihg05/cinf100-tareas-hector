import { describe, expect, it } from 'vitest'
import { choferesIniciales } from '../data/mock'
import { errorRut, fechaCorta, formatearRut, normalizarPatente, normalizarTelefono, validarRut } from './format'

describe('format', () => {
  it('valida RUT chileno con dígito verificador', () => {
    expect(validarRut('12.345.678-5')).toBe(true)
    expect(validarRut('123456785')).toBe(true)
    expect(validarRut('12.345.678-9')).toBe(false)
    expect(validarRut('1')).toBe(false)
  })

  it('los RUT de los conductores de ejemplo son válidos (se pueden editar sin cambiarlos)', () => {
    for (const c of choferesIniciales) expect(errorRut(c.rut), c.nombre).toBeNull()
  })

  it('acepta cualquier RUT real, no solo el del ejemplo', () => {
    for (const rut of ['12.987.987-4', '11.111.111-1', '13.987.654-7', '16.987.657-6', '9.876.543-3', '10.000.013-K']) {
      expect(errorRut(rut), rut).toBeNull()
    }
    expect(errorRut('10000013k')).toBeNull()
  })

  it('el mensaje del RUT dice si falla el formato o el dígito verificador', () => {
    expect(errorRut('12.987.987-6')).toMatch(/dígito verificador no corresponde/)
    expect(errorRut('12345')).toMatch(/RUT inválido/)
    expect(errorRut('')).toMatch(/RUT inválido/)
  })

  it('formatea RUT', () => {
    expect(formatearRut('123456785')).toBe('12.345.678-5')
  })

  it('normaliza teléfonos y patentes', () => {
    expect(normalizarTelefono('9 8765 4321')).toBe('+56 9 8765 4321')
    expect(normalizarTelefono('+56987654321')).toBe('+56 9 8765 4321')
    expect(normalizarTelefono('12345')).toBeNull()
    expect(normalizarPatente('fg1251')).toBe('FG-1251')
    expect(normalizarPatente('bbcd12')).toBe('BBCD-12')
    expect(normalizarPatente('xx')).toBeNull()
  })

  it('formatea fechas cortas', () => {
    expect(fechaCorta('2026-10-07')).toBe('7 oct')
    expect(fechaCorta('2026-09-30')).toBe('30 sept')
  })
})
