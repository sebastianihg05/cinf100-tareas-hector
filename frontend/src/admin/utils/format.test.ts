import { describe, expect, it } from 'vitest'
import { fechaCorta, formatearRut, normalizarPatente, normalizarTelefono, validarRut } from './format'

describe('format', () => {
  it('valida RUT chileno con dígito verificador', () => {
    expect(validarRut('12.345.678-5')).toBe(true)
    expect(validarRut('123456785')).toBe(true)
    expect(validarRut('12.345.678-9')).toBe(false)
    expect(validarRut('1')).toBe(false)
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
