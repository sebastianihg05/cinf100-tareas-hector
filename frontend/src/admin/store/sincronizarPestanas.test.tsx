import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdminProvider, useAdmin } from './AdminContext'
import { KEY } from './adminStore'

function CantidadViajes() {
  const { state } = useAdmin()
  return <p>{state.viajes.length} viajes</p>
}

/** Simula que otra pestaña guarda el estado: el navegador emite `storage` solo en las demás pestañas. */
function guardarDesdeOtraPestana(valor: string) {
  localStorage.setItem(KEY, valor)
  window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: valor }))
}

describe('sincronización entre pestañas', () => {
  it('un viaje que el admin abre en otra pestaña aparece sin recargar', () => {
    render(<AdminProvider><CantidadViajes /></AdminProvider>)
    const guardado = JSON.parse(localStorage.getItem(KEY)!)
    const antes = guardado.viajes.length
    expect(screen.getByText(`${antes} viajes`)).toBeInTheDocument()

    const nuevo = { ...guardado.viajes[0], id: 'otra-pestana', fecha: '2099-01-01' }
    act(() => guardarDesdeOtraPestana(JSON.stringify({ ...guardado, viajes: [...guardado.viajes, nuevo] })))

    expect(screen.getByText(`${antes + 1} viajes`)).toBeInTheDocument()
  })

  it('ignora otras claves y estados corruptos', () => {
    render(<AdminProvider><CantidadViajes /></AdminProvider>)
    const antes = JSON.parse(localStorage.getItem(KEY)!).viajes.length

    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'otra-clave', newValue: '{}' })))
    act(() => guardarDesdeOtraPestana('no es json'))

    expect(screen.getByText(`${antes} viajes`)).toBeInTheDocument()
  })
})
