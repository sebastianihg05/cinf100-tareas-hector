import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import {
  agregarConductor, agregarCuenta, agregarViajeBd, asignarVanBd, avisosLeidosGuardados, CONTRASENA,
} from './test/apiFalsa'

/**
 * #2905: la aplicación deja de usar localStorage. Los datos se leen y guardan en el backend, así que se
 * conservan al recargar o al entrar desde otro computador, y no queda nada de una cuenta en el navegador.
 */

const abrir = (ruta: string) => render(<MemoryRouter initialEntries={[ruta]}><App /></MemoryRouter>)

const iniciarSesion = async (correo: string) => {
  await userEvent.type(await screen.findByLabelText('Correo electrónico'), correo)
  await userEvent.type(screen.getByLabelText('Contraseña'), CONTRASENA)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))
}

const cerrarSesion = async () => {
  await userEvent.click(await screen.findByRole('link', { name: /Perfil|Ir a mi perfil/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Cerrar sesión/ }))
  await screen.findByRole('heading', { name: 'Iniciar sesión' })
}

/** Conductor de la "base" con la van FG-1251 (id 1) asignada por la administración. */
const crearConductor = () => {
  const cuenta = agregarCuenta({ nombreCompleto: 'Juan Carrasco', correo: 'dev.conductor@unab.cl', rol: 'conductor', estado: 'aprobada' })
  agregarConductor(cuenta.id)
  asignarVanBd('1', cuenta.id)
  return cuenta
}

describe('#2905: la app no guarda nada en localStorage', () => {
  it('usar los tres paneles no deja nada guardado en el navegador', async () => {
    const conductor = crearConductor()
    agregarViajeBd({ fecha: '2099-01-04', trayecto: 'Ida', vanId: 1, conductorId: conductor.id })

    abrir('/login')
    await iniciarSesion('dev.admin@unab.cl')
    for (const pantalla of ['Vans', 'Choferes', 'Pasajeros', 'Viajes']) {
      await userEvent.click(await screen.findByRole('link', { name: pantalla }))
    }
    await cerrarSesion()

    await iniciarSesion('S.constanza@uandresbello.edu')
    await userEvent.click(await screen.findByRole('link', { name: /Mis Reservas/ }))
    await cerrarSesion()

    await iniciarSesion('dev.conductor@unab.cl')
    await screen.findByRole('heading', { name: 'Panel del conductor' })

    expect(localStorage.length).toBe(0)
  })

  it('las vans se cargan justo después de iniciar sesión, sin recargar la página', async () => {
    abrir('/login')
    await iniciarSesion('dev.admin@unab.cl')
    await userEvent.click(await screen.findByRole('link', { name: 'Vans' }))
    expect(await screen.findByText('FG-1251')).toBeInTheDocument()
    expect(screen.queryByText('Debes iniciar sesión.')).not.toBeInTheDocument()
  })

  it('el conductor ve su van y sus viajes en un computador sin datos del administrador', async () => {
    const conductor = crearConductor()
    agregarViajeBd({ fecha: '2099-01-04', trayecto: 'Ida', vanId: 1, conductorId: conductor.id })

    abrir('/login')
    await iniciarSesion('dev.conductor@unab.cl')
    expect(await screen.findByText(/FG-1251/)).toBeInTheDocument()
    expect(await screen.findByText(/Quillota 980 → Santiago/)).toBeInTheDocument()
  })

  it('los avisos que el administrador marca como leídos quedan en la base y no reaparecen en otra sesión', async () => {
    const conductor = crearConductor()
    const viaje = agregarViajeBd({
      fecha: '2099-01-04', trayecto: 'Ida', vanId: 1, conductorId: conductor.id, estado: 'en-curso', iniciadoEn: '2099-01-04T09:45:00.000Z',
    })

    abrir('/login')
    await iniciarSesion('dev.admin@unab.cl')
    await userEvent.click(await screen.findByRole('button', { name: 'Notificaciones: 1 sin atender' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Notificaciones' })).getByRole('button', { name: 'Marcar como leídas' }))
    expect(avisosLeidosGuardados(1)).toContain(`viaje-iniciado:${viaje.id}`)

    // otra sesión (por ejemplo, otro computador): el aviso sigue leído
    cleanup()
    abrir('/admin/panel')
    await screen.findByRole('heading', { name: 'Panel Administración' })
    expect(await screen.findByRole('button', { name: 'Notificaciones' })).toBeInTheDocument()
  })

  it('los avisos que el conductor marca como leídos quedan en la base', async () => {
    const conductor = crearConductor()
    const viaje = agregarViajeBd({ fecha: '2099-01-04', trayecto: 'Ida', vanId: 1, conductorId: conductor.id })

    abrir('/login')
    await iniciarSesion('dev.conductor@unab.cl')
    await userEvent.click(await screen.findByRole('link', { name: /Avisos/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar todas como leídas' }))
    expect(avisosLeidosGuardados(conductor.id)).toContain(`viaje-asignado:${viaje.id}`)
    expect(localStorage.length).toBe(0)
  })
})
