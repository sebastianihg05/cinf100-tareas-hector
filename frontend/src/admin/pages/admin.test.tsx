import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type VanBd } from '../../api'
import AdminLayout from '../components/AdminLayout'
import { viajesIniciales } from '../data/mock'
import AbrirViaje from './AbrirViaje'
import { AdminProvider, useAdmin } from '../store/AdminContext'
import PerfilAdmin from './PerfilAdmin'
import SesionCerrada from './SesionCerrada'
import { diaSemana, fechaDMY, sumarDias, todayISO } from '../utils/format'
import VistaChoferes from './VistaChoferes'
import VistaPasajeros from './VistaPasajeros'
import VistaVans from './VistaVans'
import VistaViajes from './VistaViajes'

const r = (ui: React.ReactElement, path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminProvider>{ui}</AdminProvider>
    </MemoryRouter>,
  )

const proximoDia = (dia: number) => {
  let f = sumarDias(todayISO(), 1)
  while (diaSemana(f) !== dia) f = sumarDias(f, 1)
  return f
}

describe('Vans', () => {
  let vansBd: VanBd[]
  let siguienteId: number

  beforeEach(() => {
    vansBd = [
      { id: '1', patente: 'AB-1234', asientos: 9, conductorId: null, activa: true },
      { id: '2', patente: 'CD-5678', asientos: 9, conductorId: null, activa: true },
      { id: '3', patente: 'EF-9012', asientos: 9, conductorId: null, activa: true },
    ]

    siguienteId = 4

    vi.spyOn(api, 'listarVans').mockImplementation(async () => ({
      ok: true,
      datos: { vans: vansBd.map((van) => ({ ...van })) },
    }))

    vi.spyOn(api, 'crearVan').mockImplementation(async (datos) => {
      const van: VanBd = {
        id: String(siguienteId++),
        patente: datos.patente,
        asientos: 9,
        conductorId: datos.conductorId,
        activa: true,
      }

      vansBd.push(van)

      return { ok: true, datos: { van: { ...van } } }
    })

    vi.spyOn(api, 'actualizarVan').mockImplementation(async (id, cambios) => {
      const van = vansBd.find((v) => v.id === id)

      if (!van) {
        return { ok: false, status: 404, error: 'La van no existe.' }
      }

      Object.assign(van, cambios)

      if (!van.activa) van.conductorId = null

      return { ok: true, datos: { van: { ...van } } }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dar de baja pide confirmación y mueve la van a "Dadas de baja"', async () => {
    r(<VistaVans />)

    await screen.findByRole('tab', { name: 'Activas (3)' })

    const tarjeta = screen.getByText('AB-1234').closest('li')!
    await userEvent.click(within(tarjeta).getByRole('button', { name: /Dar de baja/ }))

    const dialogo = await screen.findByRole('dialog', { name: 'Dar de baja' })

    await userEvent.click(
      within(dialogo).getByRole('button', { name: 'Dar de baja' }),
    )

    expect(await screen.findByRole('tab', { name: 'Activas (2)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Dadas de baja (1)' })).toBeInTheDocument()
  })

  it('agregar van: valida la patente y luego la crea', async () => {
    r(<VistaVans />)

    await screen.findByRole('tab', { name: 'Activas (3)' })

    await userEvent.click(screen.getByRole('button', { name: /Agregar van/ }))

    const dlg = await screen.findByRole('dialog', { name: 'Agregar van' })

    await userEvent.type(within(dlg).getByLabelText('Patente'), 'zzz')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Agregar van' }))

    expect(within(dlg).getByRole('alert')).toHaveTextContent('Formato inválido')

    await userEvent.clear(within(dlg).getByLabelText('Patente'))
    await userEvent.type(within(dlg).getByLabelText('Patente'), 'gh3456')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Agregar van' }))

    expect(await screen.findByText('GH-3456')).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: 'Activas (4)' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('la capacidad de la van es fija en 9 asientos', async () => {
    r(<VistaVans />)

    await screen.findByRole('tab', { name: 'Activas (3)' })

    const tarjeta = screen.getByText('AB-1234').closest('li')!
    await userEvent.click(within(tarjeta).getByRole('button', { name: /Editar/ }))

    const dialogo = await screen.findByRole('dialog', { name: 'Editar van AB-1234' })
    const asientos = within(dialogo).getByLabelText('Cantidad de asientos') as HTMLInputElement

    expect(asientos.value).toBe('9')
    expect(asientos.readOnly).toBe(true)
  })

  it('una van sin conductor figura como "Sin asignar"', async () => {
    r(<VistaVans />)

    await screen.findByRole('tab', { name: 'Activas (3)' })

    await userEvent.click(screen.getByRole('button', { name: /Agregar van/ }))

    const dlg = await screen.findByRole('dialog', { name: 'Agregar van' })

    await userEvent.type(within(dlg).getByLabelText('Patente'), 'jk7890')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Agregar van' }))

    expect(await screen.findByText('JK-7890')).toBeInTheDocument()
    expect(await screen.findAllByText('Sin asignar')).not.toHaveLength(0)
  })
})

describe('Choferes', () => {
  it('lista los conductores activos', () => {
    r(<VistaChoferes />)
    expect(screen.getByText('Juan Carrasco')).toBeInTheDocument()
    expect(screen.getByText('JC')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activos (3)' })).toBeInTheDocument()
  })

  it('agregar conductor: rechaza RUT inválido y acepta uno válido', async () => {
    r(<VistaChoferes />)
    await userEvent.click(screen.getByRole('button', { name: /Agregar Conductor/ }))
    const dlg = screen.getByRole('dialog')

    const llenar = async (rut: string) => {
      await userEvent.clear(within(dlg).getByLabelText('RUT'))
      await userEvent.type(within(dlg).getByLabelText('RUT'), rut)
      await userEvent.click(within(dlg).getByRole('button', { name: 'Agregar conductor' }))
    }

    expect(within(dlg).queryByText('Empresa externa')).not.toBeInTheDocument()
    expect(within(dlg).queryByLabelText('Van asignada')).not.toBeInTheDocument()

    await userEvent.type(within(dlg).getByLabelText('Nombre completo'), 'Pedro Soto')
    await userEvent.type(within(dlg).getByLabelText('Correo'), 'pedro@gmail.com')
    await userEvent.type(within(dlg).getByLabelText('Vencimiento de la licencia'), '2030-01-15')
    await userEvent.type(within(dlg).getByLabelText('Celular'), '912345678')

    await llenar('12345678-5')
    expect(within(dlg).getByText(/correo institucional/)).toBeInTheDocument()

    await userEvent.clear(within(dlg).getByLabelText('Correo'))
    await userEvent.type(within(dlg).getByLabelText('Correo'), 'pedro.soto@unab.cl')

    await llenar('12345')
    expect(within(dlg).getByText(/RUT inválido/)).toBeInTheDocument()

    await llenar('12.345.678-9')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Pedro Soto')).toBeInTheDocument()
    expect(screen.getByText(/12\.345\.678-9/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activos (4)' })).toBeInTheDocument()
  })
})

describe('Pasajeros', () => {
  it('muestra fecha y asiento de la reserva', () => {
    r(<VistaPasajeros />)
    expect(screen.getByText('Asiento 6')).toBeInTheDocument()
    expect(screen.getByText('Asiento 1')).toBeInTheDocument()
    expect(screen.getAllByText(/7 oct · Vuelta/)).toHaveLength(3)
  })

  it('el contador de "Por aprobar" baja al aprobar', async () => {
    r(<VistaPasajeros />)
    expect(screen.getByRole('tab', { name: 'Por aprobar 1' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Por aprobar' })).toBeInTheDocument()
  })

  it('buscar por nombre, correo o sede filtra la lista', async () => {
    r(<VistaPasajeros />)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar pasajeros' }), 'rokamar')
    expect(screen.getByText('Hector Peña')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Urrutia')).not.toBeInTheDocument()
  })

  it('incluye las sedes Quintay y Rokamar como filtros', () => {
    r(<VistaPasajeros />)
    expect(screen.getByRole('tab', { name: 'Quintay' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Rokamar' })).toBeInTheDocument()
  })

  it('el detalle muestra la sede con campus y permite cambiar los interruptores', async () => {
    r(<VistaPasajeros />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle de Bruno Urrutia' }))
    const dlg = screen.getByRole('dialog')

    expect(within(dlg).getByText('Quillota 980 (Campus Viña del Mar)')).toBeInTheDocument()

    const abrir = within(dlg).getByRole('switch', { name: 'Puede abrir viajes' })
    expect(abrir).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(abrir)
    expect(abrir).toHaveAttribute('aria-checked', 'true')

    expect(within(dlg).queryByRole('switch', { name: 'Cuenta aprobada' })).not.toBeInTheDocument()
    expect(within(dlg).getByText('Aprobada')).toBeInTheDocument()
  })
})

describe('Viajes', () => {
  it('filtra por estado', async () => {
    r(<VistaViajes />)
    expect(screen.getAllByText(/Asientos reservados ·/)).toHaveLength(viajesIniciales.length)
    await userEvent.click(screen.getByRole('tab', { name: 'En curso' }))
    expect(screen.getByText('No hay viajes con ese filtro.')).toBeInTheDocument()
  })

  it('el administrador no tiene botón para iniciar viajes (lo hace el conductor)', () => {
    r(<VistaViajes />)
    expect(screen.queryByRole('button', { name: 'Iniciar viaje' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finalizar viaje' })).not.toBeInTheDocument()
  })

  it('cuando el conductor inicia el viaje, cambia el estado y llega una notificación', async () => {
    const Conductor = () => {
      const { setEstadoViaje } = useAdmin()
      return <button onClick={() => setEstadoViaje('f1i', 'en-curso')}>El conductor inicia f1i</button>
    }

    r(<>{appViajes}<Conductor /></>, '/admin/viajes')
    expect(screen.queryByRole('button', { name: /^Notificaciones: / })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'El conductor inicia f1i' }))
    await userEvent.click(screen.getByRole('tab', { name: 'En curso' }))
    expect(screen.getAllByText(/Asientos reservados ·/)).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: /^Notificaciones: 2/ }))
    const panel = screen.getByRole('dialog', { name: 'Notificaciones' })

    expect(within(panel).getByText('Viaje iniciado')).toBeInTheDocument()
    expect(within(panel).getByText('1 pasajero por aprobar')).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole('button', { name: 'Marcar como leídas' }))
    expect(screen.getByRole('button', { name: /^Notificaciones: 1/ })).toBeInTheDocument()
  })

  it('tocar "pasajero por aprobar" en la campana lleva al filtro correspondiente', async () => {
    const app = (
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="viajes" element={<VistaViajes />} />
          <Route path="pasajeros" element={<VistaPasajeros />} />
        </Route>
      </Routes>
    )

    r(app, '/admin/viajes')
    await userEvent.click(screen.getByRole('button', { name: /^Notificaciones/ }))
    await userEvent.click(screen.getByText('1 pasajero por aprobar'))
    expect(screen.getByRole('tab', { name: /Por aprobar/, selected: true })).toBeInTheDocument()
  })

  const appViajes = (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="viajes" element={<VistaViajes />} />
        <Route path="viajes/abrir" element={<AbrirViaje />} />
      </Route>
    </Routes>
  )

  it('"Abrir viaje" lleva a la página con trayecto Ida / Vuelta / Ida y vuelta', async () => {
    r(appViajes, '/admin/viajes')
    await userEvent.click(screen.getByRole('button', { name: 'Abrir viaje' }))
    expect(screen.getByRole('heading', { name: 'Abrir viaje' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((x) => x.textContent)).toEqual(['Ida', 'Vuelta', 'Ida y vuelta'])
  })

  it('el administrador abre viajes que salen de Quillota 980', async () => {
    r(appViajes, '/admin/viajes/abrir')
    expect(screen.queryByLabelText('Sede de origen')).not.toBeInTheDocument()

    const lunes = proximoDia(1)
    fireEvent.change(screen.getByLabelText('Fecha del viaje'), { target: { value: lunes } })
    await userEvent.click(screen.getByRole('button', { name: /Abrir viaje/ }))
    // abrir un viaje es una acción asíncrona (S3-VIA-03): vuelve al listado cuando termina de guardarse
    expect((await screen.findAllByText(fechaDMY(lunes))).length).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('la fecha de un viaje nuevo debe estar entre 1 y 30 días desde hoy', async () => {
    r(appViajes, '/admin/viajes/abrir')
    const campo = screen.getByLabelText('Fecha del viaje')

    for (const f of [todayISO(), sumarDias(todayISO(), 45)]) {
      fireEvent.change(campo, { target: { value: f } })
      await userEvent.click(screen.getByRole('button', { name: /Abrir viaje/ }))
      expect(screen.getByRole('alert')).toHaveTextContent('entre 1 y 30 días')
    }
  })

  it('filtra los viajes por trayecto y por destino', async () => {
    r(appViajes, '/admin/viajes')
    await userEvent.click(screen.getByRole('tab', { name: 'Ida' }))
    expect(screen.queryByText(/Santiago → Quillota/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Quillota 980 → Santiago/).length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('tab', { name: 'Ida y vuelta' }))
    await userEvent.selectOptions(screen.getByLabelText('Destino'), 'Quillota 980')
    expect(screen.queryByText(/Quillota 980 → Santiago/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Santiago → Quillota 980/).length).toBeGreaterThan(0)
  })

  it('cancelar un viaje pide confirmación y lo deja como "Cancelado"', async () => {
    r(appViajes, '/admin/viajes')
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancelar viaje' })[0])
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar viaje' }))

    await userEvent.click(screen.getByRole('tab', { name: 'Cancelados' }))
    const yaCancelados = viajesIniciales.filter((v) => v.estado === 'cancelado').length

    expect(screen.getAllByText(/Asientos reservados ·/)).toHaveLength(yaCancelados + 1)
    expect(screen.queryByRole('button', { name: 'Cancelar viaje' })).not.toBeInTheDocument()
  })

  it('ida y vuelta crea dos viajes sin van, y luego se les asigna una', async () => {
    r(appViajes, '/admin/viajes/abrir')
    fireEvent.change(screen.getByLabelText('Fecha del viaje'), { target: { value: proximoDia(1) } })

    await userEvent.click(screen.getByRole('radio', { name: 'Ida y vuelta' }))
    await userEvent.click(screen.getByRole('button', { name: /Abrir viaje/ }))

    // volvió al listado con 2 viajes nuevos sin van asignada
    expect(await screen.findAllByText('Sin van asignada')).toHaveLength(2)
    await userEvent.click(screen.getAllByRole('button', { name: 'Asignar van' })[0])
    const dlg = screen.getByRole('dialog')

    await userEvent.selectOptions(within(dlg).getByLabelText('Van'), within(dlg).getAllByRole('option')[1])
    await userEvent.click(within(dlg).getByRole('button', { name: 'Asignar van' }))
    await waitFor(() => expect(screen.getAllByText('Sin van asignada')).toHaveLength(1))
  })
})

describe('Perfil', () => {
  const app = (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="vans" element={<VistaVans />} />
        <Route path="perfil" element={<PerfilAdmin />} />
      </Route>
      <Route path="/login" element={<SesionCerrada />} />
    </Routes>
  )

  it('tocar el saludo lleva al perfil, sin selector de apariencia', async () => {
    r(app, '/admin/vans')
    await userEvent.click(screen.getByRole('link', { name: 'Ir a mi perfil' }))
    expect(screen.getByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument()
    expect(screen.getByText('Datos de contacto')).toBeInTheDocument()
    expect(screen.queryByText('Apariencia')).not.toBeInTheDocument()
  })

  it('cerrar sesión navega a /login', async () => {
    r(app, '/admin/perfil')
    await userEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }))
    expect(screen.getByRole('heading', { name: 'Sesión cerrada' })).toBeInTheDocument()
  })

  it('editar celular actualiza el dato', async () => {
    r(<PerfilAdmin />)
    await userEvent.click(screen.getByRole('button', { name: /Editar/ }))

    const campo = screen.getByLabelText('Celular')
    await userEvent.clear(campo)
    await userEvent.type(campo, '98765432')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()

    await userEvent.clear(campo)
    await userEvent.type(campo, '987654321')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByText('+56 9 8765 4321')).toBeInTheDocument()
  })
})

describe('Pasajeros: búsqueda por fecha y destino', () => {
  it('busca por destino y filtra por la fecha del viaje', async () => {
    r(<VistaPasajeros />)
    const total = screen.getAllByRole('listitem').length

    await userEvent.type(screen.getByLabelText('Buscar pasajeros'), 'santiago')
    const porDestino = screen.getAllByRole('listitem').length
    expect(porDestino).toBeLessThan(total)

    await userEvent.clear(screen.getByLabelText('Buscar pasajeros'))
    fireEvent.change(screen.getByLabelText('Fecha del viaje'), { target: { value: '2001-01-01' } })

    expect(screen.getByText('No hay pasajeros que coincidan.')).toBeInTheDocument()
  })
})
