import { describe, expect, it } from 'vitest'
import { estadoLicencia } from './licencia'

const enDias = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('estadoLicencia', () => {
  it('detecta licencias vencidas (incluye el día de hoy)', () => {
    expect(estadoLicencia(enDias(-1))).toBe('vencida')
    expect(estadoLicencia(enDias(0))).toBe('vencida')
  })

  it('avisa las que vencen dentro de 30 días', () => {
    expect(estadoLicencia(enDias(1))).toBe('por-vencer')
    expect(estadoLicencia(enDias(30))).toBe('por-vencer')
  })

  it('las demás están vigentes', () => {
    expect(estadoLicencia(enDias(31))).toBe('ok')
    expect(estadoLicencia(enDias(400))).toBe('ok')
  })

  it('el plazo de aviso se puede cambiar', () => {
    expect(estadoLicencia(enDias(20), 10)).toBe('ok')
  })
})
