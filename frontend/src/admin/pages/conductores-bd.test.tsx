import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../../App'
import { agregarConductor, agregarCuenta, CONTRASENA, conductorGuardado } from '../../test/apiFalsa'
import { choferesIniciales } from '../data/mock'
import { estadoInicial, reducer } from '../store/adminStore'

const abrir = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>,
  )

const iniciarSesion = async (correo: string) => {
  await userEvent.clear(screen.getByLabelText('Correo electrónico'))
  await userEvent.type(screen.getByLabelText('Correo electrónico'), correo)
  await userEvent.clear(screen.getByLabelText('Contraseña'))
  await userEvent.type(screen.getByLabelText('Contraseña'), CONTRASENA)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))
}

/** El administrador aprueba la solicitud de Camila Torres como conductora. */
const aprobarComoConductor = async () => {
  await iniciarSesion('dev.admin@unab.cl')
  await userEvent.click(await screen.findByRole('link', { name: 'Pasajeros' }))
  const tarjeta = within((await screen.findByText('Camila Torres')).closest('li')!)
  await userEvent.selectOptions(tarjeta.getByRole('combobox', { name: 'Rol de Camila Torres' }), 'conductor')
  await userEvent.click(tarjeta.getByRole('button', { name: 'Aprobar' }))
}

const tarjetaChofer = async (nombre: string) => {
  await userEvent.click(await screen.findByRole('link', { name: 'Choferes' }))
  return within((await screen.findByText(nombre)).closest('li')!)
}

describe('Conductores guardados en la base de datos', () => {
  it('al aprobar una cuenta como conductor aparece en Choferes, con RUT y licencia por completar', async () => {
    agregarCuenta({ nombreCompleto: 'Camila Torres', correo: 'camila.torres@unab.cl' })
    abrir()
    await aprobarComoConductor()

    const tarjeta = await tarjetaChofer('Camila Torres')
    expect(tarjeta.getByText('RUT y licencia sin registrar')).toBeInTheDocument()
    expect(tarjeta.getByText('Faltan RUT y licencia: usa Editar')).toBeInTheDocument()
    expect(tarjeta.getByText('camila.torres@unab.cl')).toBeInTheDocument()
  })

  it('el RUT y la licencia que completa el administrador quedan guardados en la base', async () => {
    const cuenta = agregarCuenta({ nombreCompleto: 'Camila Torres', correo: 'camila.torres@unab.cl', rol: 'conductor', estado: 'aprobada' })
    agregarConductor(cuenta.id)
    abrir()
    await iniciarSesion('dev.admin@unab.cl')

    const tarjeta = await tarjetaChofer('Camila Torres')
    await userEvent.click(tarjeta.getByRole('button', { name: /Editar/ }))
    const dlg = within(screen.getByRole('dialog'))
    // nombre, correo y celular vienen de la cuenta
    expect(dlg.getByLabelText('Nombre completo')).toHaveAttribute('readonly')
    await userEvent.type(dlg.getByLabelText('RUT'), '11111111-1')
    await userEvent.type(dlg.getByLabelText('Vencimiento de la licencia'), '2030-01-15')
    await userEvent.click(dlg.getByRole('button', { name: 'Guardar cambios' }))

    expect(conductorGuardado(cuenta.id)).toMatchObject({ rut: '11.111.111-1', licenciaHasta: '2030-01-15' })
    expect(await screen.findByText(/Rut: 11\.111\.111-1/)).toBeInTheDocument()
    expect(screen.queryByText('Faltan RUT y licencia: usa Editar')).not.toBeInTheDocument()
  })

  it('si la base rechaza el RUT, el formulario muestra el error y no se cierra', async () => {
    // otro conductor de la base ya tiene ese RUT, aunque este navegador no lo conoce
    agregarConductor(999, { rut: '11.111.111-1', licenciaHasta: '2030-01-15' })
    const cuenta = agregarCuenta({ nombreCompleto: 'Camila Torres', correo: 'camila.torres@unab.cl', rol: 'conductor', estado: 'aprobada' })
    agregarConductor(cuenta.id)
    abrir()
    await iniciarSesion('dev.admin@unab.cl')

    const tarjeta = await tarjetaChofer('Camila Torres')
    await userEvent.click(tarjeta.getByRole('button', { name: /Editar/ }))
    const dlg = within(screen.getByRole('dialog'))
    await userEvent.type(dlg.getByLabelText('RUT'), '11111111-1')
    await userEvent.type(dlg.getByLabelText('Vencimiento de la licencia'), '2030-01-15')
    await userEvent.click(dlg.getByRole('button', { name: 'Guardar cambios' }))

    expect(await dlg.findByText('Ya existe un conductor con ese RUT.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(conductorGuardado(cuenta.id)?.rut).toBeNull()
  })

  it('dar de baja a un conductor de la base queda guardado en la base', async () => {
    const cuenta = agregarCuenta({ nombreCompleto: 'Camila Torres', correo: 'camila.torres@unab.cl', rol: 'conductor', estado: 'aprobada' })
    agregarConductor(cuenta.id, { rut: '11.111.111-1', licenciaHasta: '2030-01-15' })
    abrir()
    await iniciarSesion('dev.admin@unab.cl')

    const tarjeta = await tarjetaChofer('Camila Torres')
    await userEvent.click(tarjeta.getByRole('button', { name: /Dar de baja/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dar de baja' }))

    await waitFor(() => expect(conductorGuardado(cuenta.id)?.activo).toBe(false))
    await waitFor(() => expect(screen.queryByText('Camila Torres')).not.toBeInTheDocument())
  })

  it('el conductor aprobado ya es reconocido como chofer en su panel', async () => {
    agregarCuenta({ nombreCompleto: 'Camila Torres', correo: 'camila.torres@unab.cl' })
    abrir()
    await aprobarComoConductor()
    await userEvent.click(screen.getByRole('link', { name: 'Ir a mi perfil' }))
    await userEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }))

    await iniciarSesion('camila.torres@unab.cl')
    expect(await screen.findByText(/Todavía no tienes una van asignada/)).toBeInTheDocument()
    expect(screen.queryByText(/no está registrado como chofer/)).not.toBeInTheDocument()
  })
})

describe('Sincronización de conductores (adminStore)', () => {
  it('reconoce por correo a un chofer de ejemplo y conserva su RUT y licencia si la base no los tiene', () => {
    const ejemplo = choferesIniciales[0]
    const s = reducer(estadoInicial(), {
      type: 'chofer/desdeBd',
      conductores: [{
        id: 4, nombreCompleto: 'Conductor Aprobado', correo: ejemplo.correo, telefono: '+56900000003',
        estado: 'aprobada', rut: null, licenciaHasta: null, activo: true,
      }],
    })
    const chofer = s.choferes.find((c) => c.idBd === 4)!
    expect(chofer.id).toBe(ejemplo.id)
    expect(chofer.rut).toBe(ejemplo.rut)
    expect(chofer.licenciaHasta).toBe(ejemplo.licenciaHasta)
    expect(s.choferes).toHaveLength(choferesIniciales.length)
  })

  it('un conductor desactivado en la base queda de baja y libera su van', () => {
    const inicial = estadoInicial()
    const van = inicial.vans.find((v) => v.choferId)!
    const chofer = inicial.choferes.find((c) => c.id === van.choferId)!
    const s = reducer(inicial, {
      type: 'chofer/desdeBd',
      conductores: [{
        id: 7, nombreCompleto: chofer.nombre, correo: chofer.correo, telefono: '+56911112222',
        estado: 'desactivada', rut: null, licenciaHasta: null, activo: true,
      }],
    })
    expect(s.choferes.find((c) => c.id === chofer.id)?.activo).toBe(false)
    expect(s.vans.find((v) => v.id === van.id)?.choferId).toBeNull()
  })
})
