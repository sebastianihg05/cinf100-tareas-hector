import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { agregarConductor, agregarCuenta, asignarVanBd, CONTRASENA, conductorGuardado, vanBdGuardada } from '../../test/apiFalsa'
import { choferesIniciales } from '../data/mock'
import { estadoInicial, reducer } from '../store/adminStore'

/**
 * Asignación de conductores a vans y datos del conductor (RUT y licencia) contra PostgreSQL (API falsa).
 * El error «todavía no está registrado» solo debe aparecer si la base realmente no tiene al conductor.
 */

const abrir = () => render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)

const iniciarSesion = async (correo: string) => {
  await userEvent.type(await screen.findByLabelText('Correo electrónico'), correo)
  await userEvent.type(screen.getByLabelText('Contraseña'), CONTRASENA)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))
}

const conductorEnBase = (datos: Parameters<typeof agregarConductor>[1] = {}) => {
  const cuenta = agregarCuenta({ nombreCompleto: 'Camila Torres', correo: 'camila.torres@unab.cl', rol: 'conductor', estado: 'aprobada' })
  agregarConductor(cuenta.id, datos)
  return cuenta
}

const editarVan = async (patente: string) => {
  await userEvent.click(await screen.findByRole('link', { name: 'Vans' }))
  const tarjeta = within((await screen.findByText(patente)).closest('li')!)
  await userEvent.click(tarjeta.getByRole('button', { name: /Editar/ }))
  return within(screen.getByRole('dialog'))
}

describe('Asignar un conductor a una van', () => {
  it('un conductor aprobado en la base se asigna y la van queda guardada con su id', async () => {
    const cuenta = conductorEnBase()
    abrir()
    await iniciarSesion('dev.admin@unab.cl')

    const dlg = await editarVan('FG-1251')
    await userEvent.selectOptions(dlg.getByLabelText('Conductor asignado'), await dlg.findByRole('option', { name: 'Camila Torres' }))
    await userEvent.click(dlg.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(vanBdGuardada('1')?.conductorId).toBe(cuenta.id))
    expect(screen.queryByText(/todavía no está registrado/)).not.toBeInTheDocument()
  })

  it('una van que ya tiene conductor se guarda aunque la lista de conductores no haya llegado', async () => {
    const cuenta = conductorEnBase()
    asignarVanBd('1', cuenta.id)
    // la lista de conductores tarda (o falla): la van llega con su conductor como `cbd<id>`
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
      url === '/api/admin/conductores'
        ? Promise.resolve(new Response(JSON.stringify({ error: 'Error interno del servidor.' }), { status: 500 }))
        : original(url, init))
    abrir()
    await iniciarSesion('dev.admin@unab.cl')

    const dlg = await editarVan('FG-1251')
    await userEvent.clear(dlg.getByLabelText('Patente'))
    await userEvent.type(dlg.getByLabelText('Patente'), 'FG-1252')
    await userEvent.click(dlg.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(vanBdGuardada('1')).toMatchObject({ patente: 'FG-1252', conductorId: cuenta.id }))
    expect(screen.queryByText(/todavía no está registrado/)).not.toBeInTheDocument()
  })

  it('si la base no tiene registrado al conductor, se muestra el error y la van no cambia', async () => {
    const cuenta = conductorEnBase()
    abrir()
    await iniciarSesion('dev.admin@unab.cl')
    const dlg = await editarVan('FG-1251')
    await userEvent.selectOptions(dlg.getByLabelText('Conductor asignado'), await dlg.findByRole('option', { name: 'Camila Torres' }))

    // otra persona lo da de baja en la base mientras el formulario está abierto
    conductorGuardado(cuenta.id)!.activo = false
    await userEvent.click(dlg.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText(/dado de baja y no puede tener una van/)).toBeInTheDocument()
    expect(vanBdGuardada('1')?.conductorId).toBeNull()
  })
})

describe('RUT y licencia del conductor', () => {
  it('lo que guarda el administrador queda en la base y es lo que se muestra', async () => {
    const cuenta = conductorEnBase()
    abrir()
    await iniciarSesion('dev.admin@unab.cl')
    await userEvent.click(await screen.findByRole('link', { name: 'Choferes' }))
    const tarjeta = within((await screen.findByText('Camila Torres')).closest('li')!)
    await userEvent.click(tarjeta.getByRole('button', { name: /Editar/ }))
    const dlg = within(screen.getByRole('dialog'))
    await userEvent.type(dlg.getByLabelText('RUT'), '11111111-1')
    await userEvent.type(dlg.getByLabelText('Vencimiento de la licencia'), '2030-01-15')
    await userEvent.click(dlg.getByRole('button', { name: 'Guardar cambios' }))

    expect(conductorGuardado(cuenta.id)).toMatchObject({ rut: '11.111.111-1', licenciaHasta: '2030-01-15' })
    expect(await screen.findByText('Rut: 11.111.111-1 · Licencia hasta 15 de enero de 2030')).toBeInTheDocument()
  })

  it('el perfil del conductor muestra el RUT y la licencia de la base y se actualiza al cambiarlos', async () => {
    const cuenta = conductorEnBase({ rut: '22.222.222-2', licenciaHasta: '2031-03-01' })
    abrir()
    await iniciarSesion('camila.torres@unab.cl')
    await userEvent.click(await screen.findByRole('link', { name: /Perfil/ }))

    expect(await screen.findByText('22.222.222-2')).toBeInTheDocument()
    expect(screen.getByText('1 de marzo de 2031')).toBeInTheDocument()

    // el administrador cambia los datos; el panel del conductor los vuelve a leer al sincronizar
    Object.assign(conductorGuardado(cuenta.id)!, { rut: '33.333.333-3', licenciaHasta: '2032-05-20' })
    act(() => { window.dispatchEvent(new Event('online')) })
    expect(await screen.findByText('33.333.333-3')).toBeInTheDocument()
    expect(screen.getByText('20 de mayo de 2032')).toBeInTheDocument()
  })

  it('una van que llegó antes que los conductores queda enlazada al conductor correcto', () => {
    const conVan = reducer(estadoInicial(), { type: 'van/desdeBd', vans: [{ id: '5', patente: 'AB-1234', asientos: 9, conductorId: 7, activa: true }] })
    const ejemplo = choferesIniciales[0]
    const s = reducer(conVan, {
      type: 'chofer/desdeBd',
      conductores: [{ id: 7, nombreCompleto: ejemplo.nombre, correo: ejemplo.correo, telefono: '+56911112222', estado: 'aprobada', rut: null, licenciaHasta: null, activo: true }],
    })
    const chofer = s.choferes.find((c) => c.idBd === 7)!
    expect(s.vans.find((v) => v.id === '5')?.choferId).toBe(chofer.id)
  })
})
