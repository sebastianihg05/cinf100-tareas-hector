import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { vansIniciales, viajesIniciales } from '../data/mock'
import { AdminProvider } from '../store/AdminContext'
import VistaPasajeros from './VistaPasajeros'
import PanelPendiente from './PanelPendiente'

function Destino({ nombre }: { nombre: string }) {
  const { pathname, search } = useLocation()
  return <p>{`${nombre}${search}`}<span hidden>{pathname}</span></p>
}

const abrirPanel = () =>
  render(
    <MemoryRouter initialEntries={['/admin/panel']}>
      <AdminProvider>
        <Routes>
          <Route path="/admin/panel" element={<PanelPendiente />} />
          <Route path="/admin/vans" element={<Destino nombre="Pantalla Vans" />} />
          <Route path="/admin/choferes" element={<Destino nombre="Pantalla Choferes" />} />
          <Route path="/admin/viajes" element={<Destino nombre="Pantalla Viajes" />} />
          <Route path="/admin/pasajeros" element={<VistaPasajeros />} />
        </Routes>
      </AdminProvider>
    </MemoryRouter>,
  )

describe('Panel conectado al resto del administrador', () => {
  it('muestra los indicadores con los datos compartidos', () => {
    abrirPanel()
    expect(screen.getByText('Viajes totales').closest('a')).toHaveTextContent(String(viajesIniciales.length))
    expect(screen.getByText('Vans activas').closest('a')).toHaveTextContent(String(vansIniciales.filter((v) => v.activa).length))
    expect(screen.getByText('1 pendiente')).toBeInTheDocument()
  })

  it('las tarjetas de viajes llevan a la vista de Viajes', async () => {
    abrirPanel()
    await userEvent.click(screen.getByText('Viajes pendientes').closest('a')!)
    expect(screen.getByText(/Pantalla Viajes/)).toBeInTheDocument()
  })

  it('Vans y Conductores llevan a sus vistas', async () => {
    abrirPanel()
    await userEvent.click(screen.getByText('Vans activas').closest('a')!)
    expect(screen.getByText(/Pantalla Vans/)).toBeInTheDocument()
  })

  it('"pendientes" lleva a Pasajeros con el filtro "Por aprobar" activo', async () => {
    abrirPanel()
    await userEvent.click(screen.getByText('1 pendiente'))
    expect(screen.getByRole('tab', { name: /Por aprobar/, selected: true })).toBeInTheDocument()
  })

  it('hay gráficos de barras y cada barra es un enlace', () => {
    abrirPanel()
    const grafico = screen.getByRole('region', { name: 'Viajes por estado' })
    expect(within(grafico).getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('region', { name: 'Pasajeros por sede' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ocupación de los próximos viajes' })).toBeInTheDocument()
  })

  it('una barra de sede filtra la lista de Pasajeros por esa sede', async () => {
    abrirPanel()
    const grafico = screen.getByRole('region', { name: 'Pasajeros por sede' })
    await userEvent.click(within(grafico).getByRole('link', { name: /Santiago/ }))
    expect(screen.getByRole('tab', { name: 'Santiago', selected: true })).toBeInTheDocument()
  })

  it('la torta de usuarios no llama "verificados" a las cuentas deshabilitadas', () => {
    abrirPanel()
    expect(screen.queryByText(/Verificados/)).not.toBeInTheDocument()
    expect(screen.getByText(/Deshabilitados/)).toBeInTheDocument()
  })
})

describe('Panel: reservas y viajes', () => {
  it('lista los próximos viajes y las últimas reservas', () => {
    abrirPanel()
    expect(within(screen.getByRole('region', { name: 'Próximos viajes' })).getAllByRole('link').length).toBeGreaterThan(0)
    expect(within(screen.getByRole('region', { name: 'Últimas reservas' })).getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('agrupa las reservas por día y por semana', async () => {
    abrirPanel()
    expect(screen.getByRole('region', { name: 'Reservas por día' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Por semana' }))
    expect(screen.getByRole('region', { name: 'Reservas por semana' })).toBeInTheDocument()
  })
})
