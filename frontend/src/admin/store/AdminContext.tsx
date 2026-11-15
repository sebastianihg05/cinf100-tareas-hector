import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api as clienteApi, type ConductorBd, type UsuarioBd, type ViajeBd } from '../../api'
import { leerSesion } from '../../login/sesion'
import { HORA_TRAYECTO, RUTA_TRAYECTO, type Admin, type Chofer, type EstadoViaje, type Pasajero, type Reserva, type Rol, type Trayecto, type Van, type Viaje } from '../types'
import { ahoraISO } from '../utils/format'
import { numeroDeVan } from '../utils/vanBd'
import { type AlcanceViajes } from './viajesBd'
import {
  cargarEstado,
  guardarEstado,
  KEY,
  leerEstadoGuardado,
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

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, cargarEstado)
  const [vansCargando, setVansCargando] = useState(true)
  const [vansGuardando, setVansGuardando] = useState(false)
  const [vansError, setVansError] = useState<string | null>(null)

  const estadoActual = useRef(state)
  estadoActual.current = state

  useEffect(() => {
    guardarEstado(state)
  }, [state])

  // La API es la fuente principal de las vans. localStorage queda como respaldo.
  useEffect(() => {
    let vigente = true

    const cargarVans = async () => {
      const respuesta = await clienteApi.listarVans()

      if (!vigente) return

      if (respuesta.ok) {
        dispatch({ type: 'van/desdeBd', vans: respuesta.datos.vans })
        setVansError(null)
      } else {
        setVansError(respuesta.error)
      }

      setVansCargando(false)
    }

    void cargarVans()

    return () => {
      vigente = false
    }
  }, [])

  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      if (e.key !== KEY || e.newValue === null || e.newValue === JSON.stringify(estadoActual.current)) return
      const otro = leerEstadoGuardado()
      if (otro) dispatch({ type: 'estado/otraPestana', state: otro })
    }

    window.addEventListener('storage', alCambiar)
    return () => window.removeEventListener('storage', alCambiar)
  }, [])

  const guardarVanEnApi = async (van: Van): Promise<boolean> => {
    setVansGuardando(true)
    setVansError(null)

    try {
      const chofer = van.choferId
        ? state.choferes.find((c) => c.id === van.choferId)
        : undefined

      if (van.choferId && (!chofer || chofer.idBd === undefined)) {
        setVansError('El conductor seleccionado todavía no está registrado en la base de datos.')
        return false
      }

      const conductorId = chofer?.idBd ?? null
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

      // El servidor devuelve el ID definitivo. Se conserva el conductor local asociado.
      const vanActualizada: Van = {
        id: vanBd.id,
        patente: vanBd.patente,
        asientos: vanBd.asientos,
        choferId: van.choferId,
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

  const contexto = useMemo<AdminApi>(
    () => ({
      state,
      pendientes: state.pasajeros.filter((p) => !p.aprobado).length,
      sinLeer: state.notificaciones.filter((n) => !n.leida).length,
      vansCargando,
      vansGuardando,
      vansError,
      limpiarErrorVans: () => setVansError(null),
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
        const chofer = actual.choferes.find((c) => c.id === van?.choferId)
        const r = await clienteApi.actualizarViaje(viaje.idBd, { vanId: numeroDeVan(vanId), conductorId: chofer?.idBd ?? null })
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
      marcarLeida: (id) => dispatch({ type: 'notif/leer', id }),
      marcarTodasLeidas: () => dispatch({ type: 'notif/leerTodas' }),
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

        if (!guardarEstado(siguiente)) {
          return {
            ok: false,
            tipo: 'almacenamiento',
            error: 'No se pudo guardar la reserva en este dispositivo. Revisa el almacenamiento del navegador e inténtalo de nuevo.',
          }
        }

        estadoActual.current = siguiente
        dispatch(accion)

        return { ok: true, grupoId, reservas }
      },
    }),
    [state, vansCargando, vansGuardando, vansError],
  )

  return <AdminContext.Provider value={contexto}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin debe usarse dentro de <AdminProvider>')
  return ctx
}