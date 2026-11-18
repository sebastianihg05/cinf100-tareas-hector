import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { estadoInicial, reducer } from '../admin/store/adminStore'
import { guardarSesion } from '../login/sesion'
import { agregarConductor, agregarCuenta, CONTRASENA, cuentaGuardada } from '../test/apiFalsa'

const CORREO_CONDUCTOR = 'dev.conductor@unab.cl'
const abrir = (ruta: string) => render(<MemoryRouter initialEntries={[ruta]}><App /></MemoryRouter>)

const iniciarSesion = async (correo: string) => {
  await userEvent.type(await screen.findByLabelText('Correo electrónico'), correo)
  await userEvent.type(screen.getByLabelText('Contraseña'), CONTRASENA)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))
}

/** Abre la ventana de Editar del perfil, escribe el celular nuevo y guarda. */
const cambiarCelularDelPerfil = async (celular: string) => {
  await userEvent.click(await screen.findByRole('button', { name: /Editar/ }))
  const dlg = within(screen.getByRole('dialog'))
  await userEvent.clear(dlg.getByLabelText('Celular'))
  await userEvent.type(dlg.getByLabelText('Celular'), celular)
  await userEvent.click(dlg.getByRole('button', { name: 'Guardar' }))
}

describe('un viaje a la vez', () => {
  it('con la ida en curso no se puede iniciar la vuelta; al finalizar la ida, sí', () => {
    let s = reducer(estadoInicial(), { type: 'viaje/estado', id: 'f1i', estado: 'en-curso' })
    s = reducer(s, { type: 'viaje/estado', id: 'f1v', estado: 'en-curso' })
    expect(s.viajes.find((v) => v.id === 'f1i')?.estado).toBe('en-curso')
    expect(s.viajes.find((v) => v.id === 'f1v')?.estado).toBe('pendiente')

    s = reducer(s, { type: 'viaje/estado', id: 'f1i', estado: 'completado' })
    s = reducer(s, { type: 'viaje/estado', id: 'f1v', estado: 'en-curso' })
    expect(s.viajes.find((v) => v.id === 'f1v')?.estado).toBe('en-curso')
  })

  it('en el detalle, el botón Iniciar queda bloqueado y explica que hay otro viaje en curso', async () => {
    guardarSesion({ correo: CORREO_CONDUCTOR, nombre: 'Juan Carrasco', rol: 'conductor', pasajeroId: 'p-conductor' })
    abrir('/conductor/viajes/f1i')
    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar viaje' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar inicio' }))
    expect(await screen.findByRole('button', { name: 'Finalizar viaje' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Ver el trayecto de Vuelta de las 17:00' }))
    const iniciar = await screen.findByRole('button', { name: 'Iniciar viaje' })
    expect(iniciar).toBeDisabled()
    expect(screen.getByText(/Tienes un viaje en curso \(Ida de las 06:45 hrs\)/)).toBeInTheDocument()
    // #2905: el estado vive solo en memoria; no queda nada guardado en el navegador
    expect(localStorage.length).toBe(0)
  })
})

describe('celular de los pasajeros en el panel del conductor', () => {
  it('cada pasajero muestra su celular para poder llamarlo', async () => {
    guardarSesion({ correo: CORREO_CONDUCTOR, nombre: 'Juan Carrasco', rol: 'conductor', pasajeroId: 'p-conductor' })
    abrir('/conductor/viajes/f1v')
    const seccion = await screen.findByRole('region', { name: 'Pasajeros del viaje' })
    const llamar = within(seccion).getByRole('link', { name: '+56 9 0000 0012' })
    expect(llamar).toHaveAttribute('href', 'tel:+56900000012')
  })
})

describe('cambiar el celular', () => {
  it('el conductor cambia su celular: se guarda en la base y el administrador lo ve en Choferes', async () => {
    agregarCuenta({ nombreCompleto: 'Juan Carrasco', correo: CORREO_CONDUCTOR, rol: 'conductor', estado: 'aprobada' })
    abrir('/login')
    await iniciarSesion(CORREO_CONDUCTOR)
    await userEvent.click(await screen.findByRole('link', { name: /Perfil/ }))
    await cambiarCelularDelPerfil('987654321')

    expect(cuentaGuardada(CORREO_CONDUCTOR)?.telefono).toBe('+56987654321')
    expect(await screen.findByText('+56 9 8765 4321')).toBeInTheDocument()
    // #2905: el administrador lo ve porque Choferes lee el celular de la API (no de una copia en el navegador)
    expect(localStorage.length).toBe(0)
  })

  it('el funcionario cambia su celular y queda guardado en la base', async () => {
    abrir('/login')
    await iniciarSesion('S.constanza@uandresbello.edu')
    await userEvent.click(await screen.findByRole('link', { name: /Perfil/ }))
    await cambiarCelularDelPerfil('+56 9 4444 3333')

    expect(cuentaGuardada('S.constanza@uandresbello.edu')?.telefono).toBe('+56944443333')
    expect(await screen.findByText('+56 9 4444 3333')).toBeInTheDocument()
  })

  it('el administrador cambia el celular de un conductor y queda guardado en su cuenta', async () => {
    const cuenta = agregarCuenta({ nombreCompleto: 'Camila Torres', correo: 'camila.torres@unab.cl', rol: 'conductor', estado: 'aprobada' })
    agregarConductor(cuenta.id, { rut: '11.111.111-1', licenciaHasta: '2030-01-15' })
    abrir('/login')
    await iniciarSesion('dev.admin@unab.cl')
    await userEvent.click(await screen.findByRole('link', { name: 'Choferes' }))
    const tarjeta = within((await screen.findByText('Camila Torres')).closest('li')!)
    await userEvent.click(tarjeta.getByRole('button', { name: /Editar/ }))

    const dlg = within(screen.getByRole('dialog'))
    expect(dlg.getByLabelText('Celular')).not.toHaveAttribute('readonly')
    await userEvent.clear(dlg.getByLabelText('Celular'))
    await userEvent.type(dlg.getByLabelText('Celular'), '955554444')
    await userEvent.click(dlg.getByRole('button', { name: 'Guardar cambios' }))

    expect(cuentaGuardada('camila.torres@unab.cl')?.telefono).toBe('+56955554444')
    expect(await screen.findByText('+56 9 5555 4444')).toBeInTheDocument()
  })
})
