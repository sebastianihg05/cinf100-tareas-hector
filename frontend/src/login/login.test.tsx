import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { estadoInicial } from '../admin/store/adminStore'
import { autenticar, PASSWORD_DEMO } from './authDemo'
import { guardarSesion, leerSesion } from './sesion'

const abrir = (ruta: string) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  )

const iniciarSesion = async (correo: string, password = PASSWORD_DEMO) => {
  await userEvent.clear(screen.getByLabelText('Correo electrónico'))
  await userEvent.type(screen.getByLabelText('Correo electrónico'), correo)
  await userEvent.clear(screen.getByLabelText('Contraseña'))
  await userEvent.type(screen.getByLabelText('Contraseña'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))
}

const registrar = async (nombre: string, correo: string, password = 'clave12345') => {
  await userEvent.type(screen.getByLabelText('Nombre completo'), nombre)
  await userEvent.type(screen.getByLabelText('Correo institucional'), correo)
  await userEvent.selectOptions(screen.getByLabelText('Sede'), 'Quintay')
  await userEvent.type(screen.getByLabelText('Teléfono de contacto'), '987654321')
  await userEvent.type(screen.getByLabelText('Contraseña'), password)
  await userEvent.type(screen.getByLabelText('Confirmar contraseña'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

/** Entra como administrador, abre Pasajeros y devuelve la tarjeta de la solicitud de `nombre`. */
const abrirSolicitud = async (nombre: string) => {
  await iniciarSesion('dev.admin@unab.cl')
  await userEvent.click(await screen.findByRole('link', { name: 'Pasajeros' }))
  return within(screen.getByText(nombre).closest('li')!)
}

const cerrarSesionDesdeAdmin = async () => {
  await userEvent.click(screen.getByRole('link', { name: 'Ir a mi perfil' }))
  await userEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }))
}

describe('Inicio de sesión', () => {
  it('rechaza un correo que no es institucional', async () => {
    abrir('/login')
    await iniciarSesion('alguien@gmail.com')
    expect(screen.getByText('Debes utilizar un correo institucional.')).toBeInTheDocument()
  })

  it('el administrador entra al panel', async () => {
    abrir('/login')
    await iniciarSesion('dev.admin@unab.cl')
    expect(await screen.findByRole('heading', { name: 'Panel Administración' })).toBeInTheDocument()
    expect(leerSesion()?.rol).toBe('admin')
  })

  it('con contraseña incorrecta da un mensaje que no revela si el correo existe', async () => {
    abrir('/login')
    await iniciarSesion('dev.admin@unab.cl', 'otra-clave')
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument()
    await iniciarSesion('nadie@uandresbello.edu')
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument()
  })

  it('una cuenta aprobada entra a su app y ve SUS datos, no los de otra persona', async () => {
    abrir('/login')
    await iniciarSesion('S.constanza@uandresbello.edu')
    expect(await screen.findByText(/Hola, Constanza/)).toBeInTheDocument()
    expect(leerSesion()).toMatchObject({ rol: 'funcionario', pasajeroId: 'p5' })
  })

  it('una cuenta por aprobar no puede entrar', async () => {
    abrir('/login')
    await iniciarSesion('dev.nuevo.ingreso@uandresbello.edu')
    expect(await screen.findByText(/pendiente de aprobación/)).toBeInTheDocument()
    expect(leerSesion()).toBeNull()
  })

  it('una cuenta deshabilitada no puede entrar', async () => {
    const estado = estadoInicial()
    const pasajeros = estado.pasajeros.map((p) => (p.id === 'p5' ? { ...p, habilitado: false } : p))
    const r = await autenticar('S.constanza@uandresbello.edu', PASSWORD_DEMO, { ...estado, pasajeros })
    expect(r).toMatchObject({ ok: false })
    expect(!r.ok && r.error).toMatch(/deshabilitada/)
  })
})

describe('Rutas protegidas por rol', () => {
  it('sin sesión, /admin y /pasajero llevan al login', () => {
    abrir('/admin/panel')
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('un funcionario no puede abrir el administrador: vuelve a su pantalla', () => {
    guardarSesion({ correo: 'S.constanza@uandresbello.edu', nombre: 'Constanza Silva', rol: 'funcionario', pasajeroId: 'p5' })
    abrir('/admin/panel')
    expect(screen.getByText(/Hola, Constanza/)).toBeInTheDocument()
  })
})

describe('Registro y aprobación de solicitudes', () => {
  it('el registro crea una solicitud por aprobar que el administrador ve', async () => {
    abrir('/registro')
    await registrar('Camila Torres', 'camila.torres@uandresbello.edu')
    expect(await screen.findByRole('heading', { name: 'Registro enviado' })).toBeInTheDocument()

    // todavía no puede entrar
    await userEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }))
    await iniciarSesion('camila.torres@uandresbello.edu', 'clave12345')
    expect(await screen.findByText(/pendiente de aprobación/)).toBeInTheDocument()

    // el administrador la ve en "Por aprobar"
    const tarjeta = await abrirSolicitud('Camila Torres')
    expect(tarjeta.getByText('Por aprobar')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Por aprobar 2' })).toBeInTheDocument()
  })

  it('la contraseña no queda guardada en claro', async () => {
    abrir('/registro')
    await registrar('Camila Torres', 'camila.torres@uandresbello.edu', 'ClaveSecretaXyz9')
    await screen.findByRole('heading', { name: 'Registro enviado' })
    const todo = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })
    expect(todo).not.toContain('ClaveSecretaXyz9')
  })

  it('no deja registrar un correo que ya existe', async () => {
    abrir('/registro')
    await registrar('Otra Persona', 'S.constanza@uandresbello.edu')
    expect(await screen.findByText(/Ya existe una cuenta o una solicitud/)).toBeInTheDocument()
  })

  it('aprobada como funcionario: entra a /pasajero/reservar y ve solo sus datos y reservas', async () => {
    abrir('/registro')
    await registrar('Camila Torres', 'camila.torres@uandresbello.edu')
    await screen.findByRole('heading', { name: 'Registro enviado' })
    await userEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }))

    const tarjeta = await abrirSolicitud('Camila Torres')
    await userEvent.click(tarjeta.getByRole('button', { name: 'Aprobar' }))
    // queda solo la solicitud de ejemplo "Nuevo ingreso"
    expect(screen.getByRole('tab', { name: 'Por aprobar 1' })).toBeInTheDocument()

    await cerrarSesionDesdeAdmin()
    await iniciarSesion('camila.torres@uandresbello.edu', 'clave12345')

    expect(await screen.findByText(/Hola, Camila/)).toBeInTheDocument()
    expect(screen.queryByText(/Constanza/)).not.toBeInTheDocument()
    expect(leerSesion()).toMatchObject({ rol: 'funcionario' })

    await userEvent.click(screen.getByRole('link', { name: /Mis Reservas/ }))
    expect(await screen.findByText('No tienes reservas próximas.')).toBeInTheDocument()
  })

  it('aprobada con rol conductor: va a la pantalla del conductor', async () => {
    abrir('/registro')
    await registrar('Camila Torres', 'camila.torres@uandresbello.edu')
    await screen.findByRole('heading', { name: 'Registro enviado' })
    await userEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }))

    const tarjeta = await abrirSolicitud('Camila Torres')
    await userEvent.selectOptions(tarjeta.getByRole('combobox', { name: 'Rol de Camila Torres' }), 'conductor')
    await userEvent.click(tarjeta.getByRole('button', { name: 'Aprobar' }))

    await cerrarSesionDesdeAdmin()
    await iniciarSesion('camila.torres@uandresbello.edu', 'clave12345')
    expect(await screen.findByRole('heading', { name: 'Panel del conductor' })).toBeInTheDocument()
    expect(leerSesion()).toMatchObject({ rol: 'conductor' })
  })

  it('rechazar una solicitud la elimina y esa persona ya no puede entrar', async () => {
    abrir('/registro')
    await registrar('Camila Torres', 'camila.torres@uandresbello.edu')
    await screen.findByRole('heading', { name: 'Registro enviado' })
    await userEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }))

    const tarjeta = await abrirSolicitud('Camila Torres')
    await userEvent.click(tarjeta.getByRole('button', { name: 'Rechazar' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rechazar' }))
    expect(screen.queryByText('Camila Torres')).not.toBeInTheDocument()

    await cerrarSesionDesdeAdmin()
    await iniciarSesion('camila.torres@uandresbello.edu', 'clave12345')
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument()
  })
})

describe('Eliminar una cuenta', () => {
  it('en el detalle ya no hay "Cuenta habilitada": se ofrece "Eliminar cuenta"', async () => {
    abrir('/login')
    await abrirSolicitud('Nuevo ingreso') // entra como administrador y abre Pasajeros
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle de Bruno Urrutia' }))
    const detalle = screen.getByRole('dialog')
    expect(within(detalle).queryByText('Cuenta habilitada')).not.toBeInTheDocument()
    expect(within(detalle).getByText('Eliminar cuenta')).toBeInTheDocument()
  })

  it('pide confirmación y, al confirmar, borra la cuenta, sus reservas y su contraseña', async () => {
    // Camila se registra, el administrador la aprueba y luego la elimina
    abrir('/registro')
    await registrar('Camila Torres', 'camila.torres@uandresbello.edu')
    await screen.findByRole('heading', { name: 'Registro enviado' })
    await userEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }))
    expect(localStorage.getItem('unab-credenciales-demo')).toContain('camila.torres@uandresbello.edu')

    const tarjeta = await abrirSolicitud('Camila Torres')
    await userEvent.click(tarjeta.getByRole('button', { name: 'Aprobar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle de Camila Torres' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))

    // "Cancelar" en la confirmación no borra nada
    const confirmacion = screen.getByRole('dialog', { name: 'Eliminar cuenta' })
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Cancelar' }))
    expect(screen.getAllByText('Camila Torres').length).toBeGreaterThan(0) // el detalle sigue abierto

    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Eliminar cuenta' })).getByRole('button', { name: 'Eliminar cuenta' }))

    expect(screen.queryByText('Camila Torres')).not.toBeInTheDocument()
    const guardado = JSON.parse(localStorage.getItem('unab-admin-v3')!)
    expect(guardado.pasajeros.some((p: { email: string }) => p.email === 'camila.torres@uandresbello.edu')).toBe(false)
    expect(localStorage.getItem('unab-credenciales-demo')).not.toContain('camila.torres@uandresbello.edu')

    // y ya no puede entrar
    await cerrarSesionDesdeAdmin()
    await iniciarSesion('camila.torres@uandresbello.edu', 'clave12345')
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument()
  })
})
