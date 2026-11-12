import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import DemoReactBits from './DemoReactBits'

// jsdom no tiene canvas, IntersectionObserver ni matchMedia: los 12 componentes deben montarse igual.
it('monta los 12 componentes de React Bits sin romper en el entorno de pruebas', () => {
  render(<DemoReactBits />)
  expect(screen.getByRole('button', { name: /Seleccionar asientos/ })).toBeInTheDocument()
  expect(screen.getByText('Usuarios activos')).toBeInTheDocument()
})
