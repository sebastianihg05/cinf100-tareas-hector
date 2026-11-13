import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { numeroDeVan } from './admin/utils/vanBd'
import { agregarConductor, agregarCuenta, agregarViajeBd, CONTRASENA, viajeBdGuardado } from './test/apiFalsa'

/** S3-VIA-03 (administrador) y S3-CON-02 (conductor): las pantallas leen y escriben en la API, no solo en el navegador. */

const FECHA = '2099-01-04'
const abrir = (ruta: string) => render(<MemoryRouter initialEntries={[ruta]}><App /></MemoryRouter>)

const iniciarSesion = async (correo: string) => {
  await userEvent.type(await screen.findByLabelText('Correo electrónico'), correo)
  await userEvent.type(screen.getByLabelText('Contraseña'), CONTRASENA)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar al sistema' }))
}

/** Cuenta de conductor en la "base", la misma del chofer de ejemplo Juan Carrasco (van v1). */
const crearConductor = () => {
  const cuenta = agregarCuenta({ nombreCompleto: 'Juan Carrasco', correo: 'dev.conductor@unab.cl', rol: 'conductor', estado: 'aprobada' })
  agregarConductor(cuenta.id)
  return cuenta
}

const VAN_V1 = numeroDeVan('v1')

const entrarComoAdmin = async (ruta = '/admin/viajes') => {
  abrir('/login')
  await iniciarSesion('dev.admin@unab.cl')
  await screen.findByRole('heading', { name: 'Panel Administración' })
  if (ruta !== '/admin/panel') await userEvent.click(screen.getByRole('link', { name: 'Viajes' }))
}

const tarjetaDe = async (texto: string | RegExp) => within((await screen.findAllByText(texto))[0].closest('li')!)

describe('numeroDeVan', () => {
  it('v1 es 1 y cualquier otro id da siempre el mismo número válido para un INTEGER', () => {
    expect(numeroDeVan('v1')).toBe(1)
    expect(numeroDeVan('v12')).toBe(12)
    const otro = numeroDeVan('vk3j9a2b')
    expect(otro).toBe(numeroDeVan('vk3j9a2b'))
    expect(Number.isInteger(otro) && otro >= 1 && otro <= 2147483646).toBe(true)
    expect(otro).not.toBe(numeroDeVan('vk3j9a2c'))
  })
})

describe('S3-VIA-03: gestión administrativa de viajes con la API', () => {
  it('los viajes se cargan desde la base, con su van asignada', async () => {
    const conductor = crearConductor()
    agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: conductor.id })
    await entrarComoAdmin()

    const tarjeta = await tarjetaDe('04/01/2099')
    expect(tarjeta.getByText('Quillota 980 → Santiago', { exact: false })).toBeInTheDocument()
    expect(tarjeta.getByText('FG-1251')).toBeInTheDocument()
    expect(tarjeta.getByText('Pendiente')).toBeInTheDocument()
  })

  it('abrir un viaje lo crea en la base y queda en el listado', async () => {
    await entrarComoAdmin()
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir viaje' }))
    const dia = new Date(); dia.setDate(dia.getDate() + 5)
    const fecha = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
    fireEvent.change(screen.getByLabelText('Fecha del viaje'), { target: { value: fecha } })
    await userEvent.click(screen.getByRole('radio', { name: 'Ida y vuelta' }))
    await userEvent.click(screen.getByRole('button', { name: /Abrir viaje/ }))

    await waitFor(() => expect(viajeBdGuardado(2)?.trayecto).toBe('Vuelta'))
    expect(viajeBdGuardado(1)).toMatchObject({ fecha, trayecto: 'Ida', estado: 'pendiente', vanId: null })
    expect((await screen.findAllByText('Sin van asignada')).length).toBeGreaterThanOrEqual(2)
  })

  it('si la base rechaza el viaje (ya existe), el formulario muestra el motivo', async () => {
    agregarViajeBd({ fecha: '2099-01-04', trayecto: 'Ida' })
    await entrarComoAdmin()
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir viaje' }))
    // el servidor falso rechaza la fecha repetida aunque el formulario no la conozca
    const hoy = new Date(); hoy.setDate(hoy.getDate() + 3)
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    agregarViajeBd({ fecha, trayecto: 'Ida' })
    fireEvent.change(screen.getByLabelText('Fecha del viaje'), { target: { value: fecha } })
    await userEvent.click(screen.getByRole('button', { name: /Abrir viaje/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/ya hay un viaje abierto/i)
  })

  it('la van y el conductor asignados se guardan en la base y se mantienen al recargar', async () => {
    const conductor = crearConductor()
    const viaje = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida' })
    await entrarComoAdmin()

    await userEvent.click(await within((await tarjetaDe('04/01/2099')).getByRole('button', { name: 'Asignar van' }).closest('li')!).findByRole('button', { name: 'Asignar van' }))
    const dlg = within(screen.getByRole('dialog'))
    await userEvent.selectOptions(dlg.getByLabelText('Van'), dlg.getByRole('option', { name: /FG-1251/ }))
    await userEvent.click(dlg.getByRole('button', { name: 'Asignar van' }))

    await waitFor(() => expect(viajeBdGuardado(viaje.id)).toMatchObject({ vanId: VAN_V1, conductorId: conductor.id }))
    expect(await (await tarjetaDe('04/01/2099')).findByText('FG-1251')).toBeInTheDocument()

    // "recargar": otro navegador sin datos locales vuelve a leer la asignación desde la base
    localStorage.clear()
    document.body.innerHTML = ''
    sessionStorage.clear()
    abrir('/login')
    await iniciarSesion('dev.admin@unab.cl')
    await userEvent.click(await screen.findByRole('link', { name: 'Viajes' }))
    expect(await (await tarjetaDe('04/01/2099')).findByText('FG-1251')).toBeInTheDocument()
  })

  it('cancelar un viaje pendiente cambia su estado en la base', async () => {
    const viaje = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida' })
    await entrarComoAdmin()
    const tarjeta = await tarjetaDe('04/01/2099')
    await userEvent.click(tarjeta.getByRole('button', { name: 'Cancelar viaje' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar viaje' }))

    await waitFor(() => expect(viajeBdGuardado(viaje.id)?.estado).toBe('cancelado'))
    expect(await (await tarjetaDe('04/01/2099')).findByText('Cancelado')).toBeInTheDocument()
  })

  it('los filtros muestran información real de la base', async () => {
    agregarViajeBd({ fecha: FECHA, trayecto: 'Ida' })
    agregarViajeBd({ fecha: FECHA, trayecto: 'Vuelta' })
    await entrarComoAdmin()
    await screen.findAllByText('04/01/2099')

    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: FECHA } })
    expect(screen.getAllByRole('listitem').filter((li) => li.textContent?.includes('04/01/2099'))).toHaveLength(2)

    await userEvent.click(screen.getByRole('tab', { name: 'Vuelta' }))
    const visibles = screen.getAllByRole('listitem').filter((li) => li.textContent?.includes('04/01/2099'))
    expect(visibles).toHaveLength(1)
    expect(visibles[0]).toHaveTextContent('Santiago → Quillota 980')
  })

  it('un cambio del conductor (viaje iniciado) aparece en el panel del administrador sin recargar', async () => {
    const viaje = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1 })
    await entrarComoAdmin()
    expect(await (await tarjetaDe('04/01/2099')).findByText('Pendiente')).toBeInTheDocument()

    // el conductor inicia el viaje desde su teléfono: la base cambia y el panel lo recoge en la siguiente sincronización
    Object.assign(viajeBdGuardado(viaje.id)!, { estado: 'en-curso', iniciadoEn: new Date().toISOString() })
    window.dispatchEvent(new Event('online'))

    expect(await (await tarjetaDe('04/01/2099')).findByText('En curso')).toBeInTheDocument()
  })

  it('si la carga falla, avisa el error y permite reintentar', async () => {
    agregarViajeBd({ fecha: FECHA, trayecto: 'Ida' })
    const original = globalThis.fetch
    let fallar = true
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
      fallar && url === '/api/admin/viajes' && (init?.method ?? 'GET') === 'GET'
        ? Promise.resolve(new Response(JSON.stringify({ error: 'Error interno del servidor.' }), { status: 500 }))
        : original(url, init))
    await entrarComoAdmin()

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno del servidor.')
    fallar = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect((await screen.findAllByText('04/01/2099')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Error interno del servidor.')).not.toBeInTheDocument()
  })
})

describe('S3-CON-02: panel del conductor con la API', () => {
  const reserva = (id: number, nombre: string, asiento: number) => ({
    id, grupoId: `g${id}`, usuarioId: 100 + id, nombre, telefono: '+56912345678', asiento, estado: 'pendiente' as const,
    creadaEn: '2099-01-01T10:00:00.000Z',
  })

  const entrarComoConductor = async (ruta = '/conductor/viajes') => {
    abrir('/login')
    await iniciarSesion('dev.conductor@unab.cl')
    await screen.findByRole('heading', { name: 'Panel del conductor' })
    if (ruta !== '/conductor/viajes') await userEvent.click(screen.getByRole('link', { name: /Historial/ }))
  }

  /** Deja a la vista solo los viajes de la base: los de ejemplo de la misma van no entran en estas comprobaciones. */
  const viajeDeLaBase = (idViaje: number) => () =>
    waitFor(() => {
      const enlace = document.querySelector<HTMLElement>(`a[href="/conductor/viajes/vbd${idViaje}"]`)
      expect(enlace).not.toBeNull()
      return enlace!
    })

  it('los viajes asignados se leen de la base, con sus asientos reservados', async () => {
    const c = crearConductor()
    const viaje = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id, reservas: [reserva(1, 'Ana Pérez', 3)] })
    await entrarComoConductor()

    const enlace = await viajeDeLaBase(viaje.id)()
    expect(within(enlace).getByText('Asientos reservados: 1/9')).toBeInTheDocument()
    expect(within(enlace).getByText('Pendiente')).toBeInTheDocument()
  })

  it('un viaje asignado a otro conductor no aparece', async () => {
    const c = crearConductor()
    const otro = agregarCuenta({ nombreCompleto: 'Otro Conductor', correo: 'otro@unab.cl', rol: 'conductor', estado: 'aprobada' })
    agregarConductor(otro.id)
    const propio = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id })
    const ajeno = agregarViajeBd({ fecha: FECHA, trayecto: 'Vuelta', vanId: VAN_V1, conductorId: otro.id })
    await entrarComoConductor()

    await viajeDeLaBase(propio.id)()
    expect(document.querySelector(`a[href="/conductor/viajes/vbd${ajeno.id}"]`)).toBeNull()
  })

  it('el detalle muestra los pasajeros del viaje elegido y no los de otro', async () => {
    const c = crearConductor()
    const ida = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id, reservas: [reserva(1, 'Ana Pérez', 3)] })
    agregarViajeBd({ fecha: FECHA, trayecto: 'Vuelta', vanId: VAN_V1, conductorId: c.id, reservas: [reserva(2, 'Beto Rojas', 5)] })
    await entrarComoConductor()

    await userEvent.click(await viajeDeLaBase(ida.id)())
    const pasajeros = within(await screen.findByRole('region', { name: 'Pasajeros del viaje' }))
    expect(await pasajeros.findByText('Ana Pérez')).toBeInTheDocument()
    expect(pasajeros.queryByText('Beto Rojas')).not.toBeInTheDocument()
    expect(pasajeros.getByRole('link', { name: /\+56 9 1234 5678/ })).toHaveAttribute('href', expect.stringContaining('tel:'))
  })

  it('iniciar el viaje lo actualiza en la base y finalizarlo queda registrado en el historial', async () => {
    const c = crearConductor()
    const viaje = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id, reservas: [reserva(1, 'Ana Pérez', 3)] })
    await entrarComoConductor()
    await userEvent.click(await viajeDeLaBase(viaje.id)())

    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar viaje' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar inicio' }))
    await waitFor(() => expect(viajeBdGuardado(viaje.id)?.estado).toBe('en-curso'))
    expect(viajeBdGuardado(viaje.id)?.iniciadoEn).toBeTruthy()

    await userEvent.click(await screen.findByRole('button', { name: 'Finalizar viaje' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Completar viaje' }))
    await waitFor(() => expect(viajeBdGuardado(viaje.id)?.estado).toBe('completado'))
    expect(viajeBdGuardado(viaje.id)?.finalizadoEn).toBeTruthy()
    expect(viajeBdGuardado(viaje.id)?.reservas[0].estado).toBe('completada')

    // el historial conserva el viaje completado
    await userEvent.click(screen.getByRole('link', { name: /Historial/ }))
    const enHistorial = await viajeDeLaBase(viaje.id)()
    expect(within(enHistorial).getByText('Completado')).toBeInTheDocument()
    expect(within(enHistorial).getByText('Pasajeros transportados: 1')).toBeInTheDocument()
  })

  it('la información permanece después de recargar (otra sesión sin datos locales)', async () => {
    const c = crearConductor()
    const viaje = agregarViajeBd({
      fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id, estado: 'completado',
      iniciadoEn: '2099-01-04T09:45:00.000Z', finalizadoEn: '2099-01-04T12:10:00.000Z', reservas: [{ ...reserva(1, 'Ana Pérez', 3), estado: 'completada' }],
    })
    localStorage.clear()
    await entrarComoConductor('/conductor/historial')
    const enHistorial = await viajeDeLaBase(viaje.id)()
    expect(within(enHistorial).getByText('Completado')).toBeInTheDocument()
  })

  it('si la API rechaza iniciar el viaje, lo avisa y el viaje sigue pendiente', async () => {
    const c = crearConductor()
    const viaje = agregarViajeBd({ fecha: FECHA, trayecto: 'Ida', vanId: VAN_V1, conductorId: c.id })
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
      url.endsWith('/iniciar')
        ? Promise.resolve(new Response(JSON.stringify({ error: 'Ya tienes un viaje en curso. Finalízalo antes de iniciar otro.' }), { status: 409 }))
        : original(url, init))
    await entrarComoConductor()
    await userEvent.click(await viajeDeLaBase(viaje.id)())

    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar viaje' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar inicio' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya tienes un viaje en curso')
    expect(viajeBdGuardado(viaje.id)?.estado).toBe('pendiente')
    expect(screen.getByRole('button', { name: 'Iniciar viaje' })).toBeInTheDocument()
  })

  it('muestra "Cargando viajes…" mientras responde la API y el error si no hay conexión', async () => {
    crearConductor()
    const original = globalThis.fetch
    let liberar: () => void = () => {}
    const espera = new Promise<void>((r) => { liberar = r })
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (url === '/api/conductor/viajes') {
        await espera
        throw new TypeError('Failed to fetch')
      }
      return original(url, init)
    })
    await entrarComoConductor()

    expect(await screen.findByText('Cargando viajes…')).toBeInTheDocument()
    liberar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
    expect(screen.queryByText('Cargando viajes…')).not.toBeInTheDocument()
  })
})
