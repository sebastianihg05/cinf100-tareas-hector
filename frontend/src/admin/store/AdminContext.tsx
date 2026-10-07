import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import type { Admin, Chofer, EstadoViaje, Pasajero, Reserva, Van, Viaje } from '../types'
import { ahoraISO } from '../utils/format'
import { cargarEstado, guardarEstado, nuevoId, reducer, type Action, type State } from './adminStore'
import {
  agruparReservas, asientosOcupados, capacidadDeViaje, validarSolicitud,
  type GrupoReserva, type ResultadoReserva, type SolicitudReserva,
} from './reservas'

type AdminApi = {
  state: State
  pendientes: number
  saveVan: (van: Van) => void
  toggleVan: (id: string) => void
  saveChofer: (chofer: Chofer) => void
  toggleChofer: (id: string) => void
  patchPasajero: (id: string, patch: Partial<Pasajero>) => void
  addViajes: (viajes: Viaje[]) => void
  setEstadoViaje: (id: string, estado: EstadoViaje) => void
  marcarLeida: (id: string) => void
  marcarTodasLeidas: () => void
  /** notificaciones sin leer (viajes iniciados) */
  sinLeer: number
  asignarVanViaje: (id: string, vanId: string) => void
  updateAdmin: (patch: Partial<Admin>) => void
  choferDeVan: (van: Van) => Chofer | undefined
  vanDeChofer: (chofer: Chofer) => Van | undefined
  /** Reservas del pasajero separadas en próximas e historial */
  reservasDe: (pasajeroId: string) => { proximas: GrupoReserva[]; historial: GrupoReserva[] }
  /** Reserva 1 o 2 asientos (ida / vuelta) de forma atómica: o se guardan todos o ninguno */
  crearReservas: (pasajeroId: string, solicitud: SolicitudReserva[]) => ResultadoReserva
  /** Capacidad del viaje (`undefined` si todavía no tiene van asignada) */
  capacidadDe: (viaje: Viaje) => number | undefined
  /** Números de asiento ya tomados en el viaje */
  asientosOcupadosDe: (viajeId: string) => number[]
}

const AdminContext = createContext<AdminApi | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, cargarEstado)
  // Última versión del estado, para validar y guardar una reserva sin depender del ciclo de render.
  const estadoActual = useRef(state)
  estadoActual.current = state

  useEffect(() => { guardarEstado(state) }, [state])

  const api = useMemo<AdminApi>(
    () => ({
      state,
      pendientes: state.pasajeros.filter((p) => !p.aprobado).length,
      sinLeer: state.notificaciones.filter((n) => !n.leida).length,
      saveVan: (van) => dispatch({ type: 'van/save', van }),
      toggleVan: (id) => dispatch({ type: 'van/toggle', id }),
      saveChofer: (chofer) => dispatch({ type: 'chofer/save', chofer }),
      toggleChofer: (id) => dispatch({ type: 'chofer/toggle', id }),
      patchPasajero: (id, patch) => dispatch({ type: 'pasajero/patch', id, patch }),
      addViajes: (viajes) => dispatch({ type: 'viaje/add', viajes }),
      // Lo llama la app del conductor (aquí solo se simula en desarrollo). Al iniciar, avisa al administrador.
      setEstadoViaje: (id, estado) =>
        dispatch({
          type: 'viaje/estado',
          id,
          estado,
          notificacion: estado === 'en-curso'
            ? { id: nuevoId('n'), tipo: 'viaje-iniciado', viajeId: id, fecha: ahoraISO(), leida: false }
            : undefined,
        }),
      marcarLeida: (id) => dispatch({ type: 'notif/leer', id }),
      marcarTodasLeidas: () => dispatch({ type: 'notif/leerTodas' }),
      asignarVanViaje: (id, vanId) => dispatch({ type: 'viaje/van', id, vanId }),
      updateAdmin: (patch) => dispatch({ type: 'admin/update', patch }),
      choferDeVan: (van) => state.choferes.find((c) => c.id === van.choferId),
      vanDeChofer: (chofer) => state.vans.find((v) => v.choferId === chofer.id),
      reservasDe: (pasajeroId) => agruparReservas(state, pasajeroId),
      capacidadDe: (viaje) => capacidadDeViaje(state, viaje),
      asientosOcupadosDe: (viajeId) => asientosOcupados(state.reservas, viajeId),
      crearReservas: (pasajeroId, solicitud) => {
        const actual = estadoActual.current
        const conflictos = validarSolicitud(actual, pasajeroId, solicitud)
        if (conflictos.length > 0) {
          return { ok: false, tipo: 'conflicto', error: conflictos[0].mensaje, conflictos }
        }
        const grupoId = nuevoId('g')
        const creadaEn = ahoraISO()
        const reservas: Reserva[] = solicitud.map((it) => ({
          id: nuevoId('r'), grupoId, pasajeroId, viajeId: it.viajeId, trayecto: it.trayecto, asiento: it.asiento,
          estado: 'pendiente', creadaEn,
        }))
        const accion: Action = { type: 'reserva/crear', reservas }
        const siguiente = reducer(actual, accion)
        if (!guardarEstado(siguiente)) {
          return {
            ok: false, tipo: 'almacenamiento',
            error: 'No se pudo guardar la reserva en este dispositivo. Revisa el almacenamiento del navegador e inténtalo de nuevo.',
          }
        }
        estadoActual.current = siguiente
        dispatch(accion)
        return { ok: true, grupoId, reservas }
      },
    }),
    [state],
  )

  return <AdminContext.Provider value={api}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin debe usarse dentro de <AdminProvider>')
  return ctx
}
