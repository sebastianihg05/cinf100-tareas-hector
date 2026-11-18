import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api as clienteApi, type ConductorBd, type UsuarioBd, type VanBd, type ViajeBd } from '../../api'
import { leerSesion } from '../../login/sesion'
import { HORA_TRAYECTO, RUTA_TRAYECTO, type Admin, type Chofer, type EstadoViaje, type Pasajero, type Reserva, type Rol, type Trayecto, type Van, type Viaje } from '../types'
import { ahoraISO } from '../utils/format'
import { numeroDeVan } from '../utils/vanBd'
import { type AlcanceViajes } from './viajesBd'
import {
  cargarEstado,
  estadoInicial,
  estadoVacio,
  nuevoId,
  reducer,
  type Action,
  type State,
} from './adminStore'
import {
  agruparReservas,
  asientosOcupados,
  cancelables,
  capacidadDeViaje,
  validarCambioAsientos,
  validarSolicitud,
  type CambioAsiento,
  type GrupoReserva,
  type ResultadoReserva,
  type SolicitudReserva,
} from './reservas'

export type ResultadoCancelacion =
  | { ok: true; cantidad: number }
  | { ok: false; error: string }

export type ResultadoEdicion =
  | { ok: true }
  | { ok: false; error: string }

type AdminApi = {
  state: State
  pendientes: number
  vansCargando: boolean
  vansGuardando: boolean
  vansError: string | null
  limpiarErrorVans: () => void
  /** #2905: vuelve a pedir las vans a la API (al entrar al panel del administrador) */
  recargarVans: () => Promise<void>
  /** Vuelve a pedir los conductores a la API: cada uno queda con su id de PostgreSQL (`idBd`), RUT y licencia */
  recargarConductores: () => Promise<void>
  /** Copia en la app las vans que devolvió la API (el conductor recibe solo la suya) */
  sincronizarVans: (vans: VanBd[]) => void
  /** Avisos del administrador que ya leyó, guardados en la base (tabla avisos_leidos) */
  cargarAvisosLeidos: () => Promise<void>
  /**
   * Borra lo que hay en memoria al iniciar o cerrar sesión (#2905): `conServidor` parte vacío y espera a la API;
   * sin servidor vuelve a los datos de ejemplo.
   */
  reiniciarDatos: (conServidor: boolean) => void
  saveVan: (van: Van) => Promise<boolean>
  toggleVan: (id: string) => Promise<boolean>
  saveChofer: (chofer: Chofer) => void
  toggleChofer: (id: string) => void
  patchPasajero: (id: string, patch: Partial<Pasajero>) => void
  sincronizarCuentas: (usuarios: UsuarioBd[]) => void
  sincronizarConductores: (conductores: ConductorBd[]) => void
  aprobarSolicitud: (id: string, rol: Rol) => void
  eliminarPasajero: (id: string) => void
  rechazarSolicitud: (id: string) => void
  addViajes: (viajes: Viaje[]) => void
  setEstadoViaje: (id: string, estado: EstadoViaje) => void
  /** Copia en la app los viajes que devolvió el backend (S3-VIA-03 y S3-CON-02) */
  sincronizarViajes: (viajes: ViajeBd[], alcance: AlcanceViajes) => void
  /** Abre ida, vuelta o ambos en una fecha; con sesión del servidor se guardan en PostgreSQL */
  abrirViajes: (fecha: string, trayectos: Trayecto[]) => Promise<ResultadoEdicion>
  /** Asigna una van (y su conductor) a un viaje pendiente */
  asignarVan: (viajeId: string, vanId: string) => Promise<ResultadoEdicion>
  /** Cancela un viaje pendiente (administración) */
  cancelarViaje: (viajeId: string) => Promise<ResultadoEdicion>
  /** El conductor inicia o finaliza su viaje; en los viajes de la base se registra mediante la API */
  cambiarEstadoViaje: (viajeId: string, estado: 'en-curso' | 'completado') => Promise<ResultadoEdicion>
  marcarLeida: (id: string) => void
  marcarTodasLeidas: () => void
  sinLeer: number
  asignarVanViaje: (id: string, vanId: string) => void
  updateAdmin: (patch: Partial<Admin>) => void
  choferDeVan: (van: Van) => Chofer | undefined
  vanDeChofer: (chofer: Chofer) => Van | undefined
  reservasDe: (pasajeroId: string) => { proximas: GrupoReserva[]; historial: GrupoReserva[] }
  crearReservas: (pasajeroId: string, solicitud: SolicitudReserva[]) => ResultadoReserva
  cancelarReserva: (pasajeroId: string, grupoId: string) => ResultadoCancelacion
  cambiarAsientos: (pasajeroId: string, grupoId: string, cambios: CambioAsiento[]) => ResultadoEdicion
  capacidadDe: (viaje: Viaje) => number | undefined
  asientosOcupadosDe: (viajeId: string) => number[]
}

const AdminContext = createContext<AdminApi | null>(null)

/** Solo las sesiones iniciadas en el servidor (con token) guardan en PostgreSQL; sin token se trabaja con los datos locales. */
const conServidor = () => Boolean(leerSesion()?.token)

/**
 * Clave en avisos_leidos de un aviso del administrador: solo los de viajes de la base (`nbd<id>`),
 * con el formato `tipo:id` que exige la tabla. Los avisos de ejemplo no se guardan.
 */
export const claveAvisoAdmin = (id: string) => (/^nbd\d+$/.test(id) ? `viaje-iniciado:${id.slice(3)}` : null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, cargarEstado)
  const [vansCargando, setVansCargando] = useState(true)
  const [vansGuardando, setVansGuardando] = useState(false)
  const [vansError, setVansError] = useState<string | null>(null)

  const estadoActual = useRef(state)
  estadoActual.current = state

  // #2905: el estado vive solo en memoria. Las vans se piden a la API al entrar al panel del administrador
  // (AdminLayout), así también se cargan justo después de iniciar sesión, sin recargar la página.
  const recargarVans = async () => {
    const respuesta = await clienteApi.listarVans()
    if (respuesta.ok) {
      dispatch({ type: 'van/desdeBd', vans: respuesta.datos.vans })
      setVansError(null)
    } else {
      setVansError(respuesta.error)
    }
    setVansCargando(false)
  }

  // Conductores registrados en PostgreSQL. Sin sesión del servidor se trabaja con los de ejemplo.
  const recargarConductores = async () => {
    if (!conServidor()) return
    const respuesta = await clienteApi.listarConductores()
    if (respuesta.ok) {
      const accion: Action = { type: 'chofer/desdeBd', conductores: respuesta.datos.conductores }
      estadoActual.current = reducer(estadoActual.current, accion)
      dispatch(accion)
    }
  }

  /**
   * id en PostgreSQL del conductor elegido en el panel. Se busca, en orden: en el conductor ya sincronizado,
   * en el id local `cbd<id>` (una van puede llegar antes que la lista de conductores) y, si no aparece,
   * se vuelve a pedir la lista a la API. Solo devuelve `undefined` si la base realmente no lo tiene registrado.
   */
  const idBdDeConductor = async (choferId: string): Promise<number | undefined> => {
    const buscar = () => {
      const chofer = estadoActual.current.choferes.find((c) => c.id === choferId)
      if (chofer?.idBd !== undefined) return chofer.idBd
      const local = /^cbd(\d+)$/.exec(choferId)
      return local ? Number(local[1]) : undefined
    }
    const encontrado = buscar()
    if (encontrado !== undefined || !conServidor()) return encontrado

    // el conductor de la lista local aún no tiene su id: se busca por correo en la lista actual de la base
    const correo = estadoActual.current.choferes.find((c) => c.id === choferId)?.correo.toLowerCase()
    await recargarConductores()
    const enBase = correo ? estadoActual.current.choferes.find((c) => c.correo.toLowerCase() === correo) : undefined
    return enBase?.idBd ?? buscar()
  }

  // Avisos del administrador que ya leyó: vienen de la tabla avisos_leidos, no del navegador.
  const [leidosBd, setLeidosBd] = useState<Set<string>>(() => new Set())
  const cargarAvisosLeidos = async () => {
    if (!conServidor()) return
    const r = await clienteApi.avisosLeidos()
    if (r.ok) setLeidosBd(new Set(r.datos.leidos))
  }
  const guardarLeidos = (claves: string[]) => {
    if (claves.length === 0 || !conServidor()) return
    setLeidosBd((antes) => new Set([...antes, ...claves]))
    void clienteApi.marcarAvisosLeidos(claves)
  }

  const guardarVanEnApi = async (van: Van): Promise<boolean> => {
    setVansGuardando(true)
    setVansError(null)

    try {
      // El conductor se identifica con su id de PostgreSQL. El mensaje solo aparece si la base no lo tiene.
      const conductorId = van.choferId ? await idBdDeConductor(van.choferId) : null

      if (conductorId === undefined) {
        setVansError('El conductor seleccionado todavía no está registrado en la base de datos.')
        return false
      }
      const esEdicionBd = /^\d+$/.test(van.id)

      const respuesta = esEdicionBd
        ? await clienteApi.actualizarVan(van.id, {
            patente: van.patente,
            conductorId,
            activa: van.activa,
          })
        : await clienteApi.crearVan({
            patente: van.patente,
            conductorId,
          })

      if (!respuesta.ok) {
        setVansError(respuesta.error)
        return false
      }

      const vanBd = respuesta.datos.van

      // El servidor devuelve el ID definitivo y el conductor que quedó guardado.
      const choferGuardado = vanBd.conductorId === null
        ? null
        : estadoActual.current.choferes.find((c) => c.idBd === vanBd.conductorId)?.id ?? van.choferId
      const vanActualizada: Van = {
        id: vanBd.id,
        patente: vanBd.patente,
        asientos: vanBd.asientos,
        choferId: choferGuardado,
        activa: vanBd.activa,
      }

      dispatch({ type: 'van/save', van: vanActualizada })

      // Sincroniza el listado completo con PostgreSQL después de guardar.
      const listado = await clienteApi.listarVans()

      if (listado.ok) {
        dispatch({ type: 'van/desdeBd', vans: listado.datos.vans })
      } else {
        setVansError(`La van se guardó, pero no se pudo actualizar el listado: ${listado.error}`)
      }

      return true
    } finally {
      setVansGuardando(false)
    }
  }

  const cambiarEstadoVan = async (id: string): Promise<boolean> => {
    const van = state.vans.find((v) => v.id === id)

    if (!van) {
      setVansError('No se encontró la van seleccionada.')
      return false
    }

    if (!/^\d+$/.test(id)) {
      setVansError('Esta van no tiene un identificador de PostgreSQL. Recarga el listado e inténtalo de nuevo.')
      return false
    }

    setVansGuardando(true)
    setVansError(null)

    try {
      const respuesta = await clienteApi.actualizarVan(id, {
        activa: !van.activa,
      })

      if (!respuesta.ok) {
        setVansError(respuesta.error)
        return false
      }

      const vanBd = respuesta.datos.van
      const chofer = vanBd.conductorId === null
        ? undefined
        : state.choferes.find((c) => c.idBd === vanBd.conductorId)

      dispatch({
        type: 'van/save',
        van: {
          id: vanBd.id,
          patente: vanBd.patente,
          asientos: vanBd.asientos,
          activa: vanBd.activa,
          choferId: chofer?.id ?? null,
        },
      })

      const listado = await clienteApi.listarVans()

      if (listado.ok) {
        dispatch({ type: 'van/desdeBd', vans: listado.datos.vans })
      } else {
        setVansError(`El estado se actualizó, pero no se pudo actualizar el listado: ${listado.error}`)
      }

      return true
    } finally {
      setVansGuardando(false)
    }
  }

  const estadoVisible = useMemo<State>(() => {
    if (leidosBd.size === 0) return state
    return {
      ...state,
      notificaciones: state.notificaciones.map((n) => {
        const clave = claveAvisoAdmin(n.id)
        return clave && leidosBd.has(clave) ? { ...n, leida: true } : n
      }),
    }
  }, [state, leidosBd])

  const contexto = useMemo<AdminApi>(
    () => ({
      state: estadoVisible,
      pendientes: state.pasajeros.filter((p) => !p.aprobado).length,
      sinLeer: estadoVisible.notificaciones.filter((n) => !n.leida).length,
      vansCargando,
      vansGuardando,
      vansError,
      limpiarErrorVans: () => setVansError(null),
      recargarVans,
      recargarConductores,
      sincronizarVans: (vans) => dispatch({ type: 'van/desdeBd', vans }),
      cargarAvisosLeidos,
      reiniciarDatos: (servidor) => {
        const nuevo = servidor ? estadoVacio() : estadoInicial()
        estadoActual.current = nuevo
        dispatch({ type: 'estado/reiniciar', state: nuevo })
        setLeidosBd(new Set())
        setVansCargando(true)
        setVansError(null)
      },
      saveVan: guardarVanEnApi,
      toggleVan: cambiarEstadoVan,
      saveChofer: (chofer) => dispatch({ type: 'chofer/save', chofer }),
      toggleChofer: (id) => dispatch({ type: 'chofer/toggle', id }),
      patchPasajero: (id, patch) => dispatch({ type: 'pasajero/patch', id, patch }),
      sincronizarCuentas: (usuarios) => dispatch({ type: 'pasajero/desdeBd', usuarios }),
      sincronizarConductores: (conductores) => dispatch({ type: 'chofer/desdeBd', conductores }),
      aprobarSolicitud: (id, rol) => dispatch({ type: 'pasajero/aprobar', id, rol }),
      rechazarSolicitud: (id) => dispatch({ type: 'pasajero/rechazar', id }),
      eliminarPasajero: (id) => dispatch({ type: 'pasajero/eliminar', id }),
      addViajes: (viajes) => dispatch({ type: 'viaje/add', viajes }),
      setEstadoViaje: (id, estado) =>
        dispatch({
          type: 'viaje/estado',
          id,
          estado,
          notificacion: estado === 'en-curso'
            ? { id: nuevoId('n'), tipo: 'viaje-iniciado', viajeId: id, fecha: ahoraISO(), leida: false }
            : undefined,
        }),
      sincronizarViajes: (viajes, alcance) => dispatch({ type: 'viaje/desdeBd', viajes, alcance }),
      abrirViajes: async (fecha, trayectos) => {
        if (!conServidor()) {
          dispatch({ type: 'viaje/add', viajes: trayectos.map((t) => ({
            id: nuevoId('t'), ...RUTA_TRAYECTO[t], trayecto: t, fecha, hora: HORA_TRAYECTO[t], vanId: null, reservados: 0, estado: 'pendiente' as const,
          })) })
          return { ok: true }
        }
        const r = await clienteApi.abrirViajes(fecha, trayectos)
        if (!r.ok) return { ok: false, error: r.error }
        dispatch({ type: 'viaje/desdeBd', viajes: r.datos.viajes, alcance: { tipo: 'parcial' } })
        return { ok: true }
      },
      asignarVan: async (viajeId, vanId) => {
        const actual = estadoActual.current
        const viaje = actual.viajes.find((v) => v.id === viajeId)
        if (!viaje) return { ok: false, error: 'El viaje ya no existe.' }
        if (viaje.idBd === undefined || !conServidor()) {
          dispatch({ type: 'viaje/van', id: viajeId, vanId })
          return { ok: true }
        }
        const van = actual.vans.find((v) => v.id === vanId)
        // antes, un conductor sin id local se enviaba como null y el viaje quedaba sin conductor
        const conductorId = van?.choferId ? await idBdDeConductor(van.choferId) : null
        if (conductorId === undefined) return { ok: false, error: 'El conductor de esa van todavía no está registrado en la base de datos.' }
        const r = await clienteApi.actualizarViaje(viaje.idBd, { vanId: numeroDeVan(vanId), conductorId })
        if (!r.ok) return { ok: false, error: r.error }
        dispatch({ type: 'viaje/desdeBd', viajes: [r.datos.viaje], alcance: { tipo: 'parcial' } })
        return { ok: true }
      },
      cancelarViaje: async (viajeId) => {
        const viaje = estadoActual.current.viajes.find((v) => v.id === viajeId)
        if (!viaje) return { ok: false, error: 'El viaje ya no existe.' }
        if (viaje.idBd === undefined || !conServidor()) {
          dispatch({ type: 'viaje/estado', id: viajeId, estado: 'cancelado' })
          return { ok: true }
        }
        const r = await clienteApi.actualizarViaje(viaje.idBd, { estado: 'cancelado' })
        if (!r.ok) return { ok: false, error: r.error }
        dispatch({ type: 'viaje/desdeBd', viajes: [r.datos.viaje], alcance: { tipo: 'parcial' } })
        return { ok: true }
      },
      cambiarEstadoViaje: async (viajeId, estado) => {
        const viaje = estadoActual.current.viajes.find((v) => v.id === viajeId)
        if (!viaje) return { ok: false, error: 'No encontramos este viaje entre los que tienes asignados.' }
        if (viaje.idBd === undefined || !conServidor()) {
          // viaje de ejemplo: se guarda solo en este navegador, como antes
          dispatch({
            type: 'viaje/estado', id: viajeId, estado,
            notificacion: estado === 'en-curso'
              ? { id: nuevoId('n'), tipo: 'viaje-iniciado', viajeId, fecha: ahoraISO(), leida: false }
              : undefined,
          })
          return { ok: true }
        }
        const r = estado === 'en-curso' ? await clienteApi.iniciarViaje(viaje.idBd) : await clienteApi.finalizarViaje(viaje.idBd)
        if (!r.ok) return { ok: false, error: r.error }
        dispatch({ type: 'viaje/desdeBd', viajes: [r.datos.viaje], alcance: { tipo: 'parcial' } })
        return { ok: true }
      },
      marcarLeida: (id) => {
        dispatch({ type: 'notif/leer', id })
        const clave = claveAvisoAdmin(id)
        if (clave) guardarLeidos([clave])
      },
      marcarTodasLeidas: () => {
        dispatch({ type: 'notif/leerTodas' })
        guardarLeidos(estadoVisible.notificaciones.filter((n) => !n.leida).map((n) => claveAvisoAdmin(n.id)).filter((c): c is string => c !== null))
      },
      asignarVanViaje: (id, vanId) => dispatch({ type: 'viaje/van', id, vanId }),
      updateAdmin: (patch) => dispatch({ type: 'admin/update', patch }),
      choferDeVan: (van) => state.choferes.find((c) => c.id === van.choferId),
      vanDeChofer: (chofer) => state.vans.find((v) => v.choferId === chofer.id),
      reservasDe: (pasajeroId) => agruparReservas(state, pasajeroId),
      capacidadDe: (viaje) => capacidadDeViaje(state, viaje),
      asientosOcupadosDe: (viajeId) => asientosOcupados(state.reservas, viajeId),
      cancelarReserva: (pasajeroId, grupoId) => {
        const actual = estadoActual.current
        const ids = cancelables(actual, pasajeroId, grupoId).map((r) => r.id)

        if (ids.length === 0) {
          return {
            ok: false,
            error: 'Esta reserva ya no se puede cancelar: el viaje ya salió o la reserva ya no está pendiente.',
          }
        }

        const accion: Action = { type: 'reserva/cancelar', ids }
        estadoActual.current = reducer(actual, accion)
        dispatch(accion)

        return { ok: true, cantidad: ids.length }
      },
      cambiarAsientos: (pasajeroId, grupoId, cambios) => {
        const actual = estadoActual.current
        const conflictos = validarCambioAsientos(actual, pasajeroId, grupoId, cambios)

        if (conflictos.length > 0) return { ok: false, error: conflictos[0].mensaje }

        const accion: Action = { type: 'reserva/asientos', pasajeroId, grupoId, cambios }
        estadoActual.current = reducer(actual, accion)
        dispatch(accion)

        return { ok: true }
      },
      crearReservas: (pasajeroId, solicitud) => {
        const actual = estadoActual.current
        const conflictos = validarSolicitud(actual, pasajeroId, solicitud)

        if (conflictos.length > 0) {
          return { ok: false, tipo: 'conflicto', error: conflictos[0].mensaje, conflictos }
        }

        const grupoId = nuevoId('g')
        const creadaEn = ahoraISO()
        const reservas: Reserva[] = solicitud.map((it) => ({
          id: nuevoId('r'),
          grupoId,
          pasajeroId,
          viajeId: it.viajeId,
          trayecto: it.trayecto,
          asiento: it.asiento,
          estado: 'pendiente',
          creadaEn,
        }))

        const accion: Action = { type: 'reserva/crear', reservas }
        const siguiente = reducer(actual, accion)
        estadoActual.current = siguiente
        dispatch(accion)

        return { ok: true, grupoId, reservas }
      },
    }),
    [state, estadoVisible, vansCargando, vansGuardando, vansError],
  )

  return <AdminContext.Provider value={contexto}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin debe usarse dentro de <AdminProvider>')
  return ctx
}