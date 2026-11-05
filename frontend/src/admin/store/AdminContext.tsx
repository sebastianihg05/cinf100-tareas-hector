import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import type { ConductorBd, UsuarioBd } from '../../api'
import type { Admin, Chofer, EstadoViaje, Pasajero, Reserva, Rol, Van, Viaje } from '../types'
import { ahoraISO } from '../utils/format'
import { cargarEstado, guardarEstado, nuevoId, reducer, type Action, type State } from './adminStore'
import {
  agruparReservas, asientosOcupados, cancelables, capacidadDeViaje, validarCambioAsientos, validarSolicitud,
  type CambioAsiento, type GrupoReserva, type ResultadoReserva, type SolicitudReserva,
} from './reservas'

export type ResultadoCancelacion = { ok: true; cantidad: number } | { ok: false; error: string }

export type ResultadoEdicion = { ok: true } | { ok: false; error: string }

type AdminApi = {
  state: State
  pendientes: number
  saveVan: (van: Van) => void
  toggleVan: (id: string) => void
  saveChofer: (chofer: Chofer) => void
  toggleChofer: (id: string) => void
  patchPasajero: (id: string, patch: Partial<Pasajero>) => void
  /** Copia en la app las cuentas que devolvió el backend (registro, login y administración, BD-17/18) */
  sincronizarCuentas: (usuarios: UsuarioBd[]) => void
  /** Copia en la lista de choferes los conductores guardados en la base */
  sincronizarConductores: (conductores: ConductorBd[]) => void
  /** Aprueba una solicitud y le asigna su rol (se hace una sola vez) */
  aprobarSolicitud: (id: string, rol: Rol) => void
  /** Elimina la cuenta de un pasajero junto con todas sus reservas (libera los asientos y el espacio guardado) */
  eliminarPasajero: (id: string) => void
  /** Rechaza una solicitud: se elimina y la persona tendría que registrarse de nuevo */
  rechazarSolicitud: (id: string) => void
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
  /** Cancela una reserva completa del pasajero (todos sus trayectos pendientes) y libera los asientos */
  cancelarReserva: (pasajeroId: string, grupoId: string) => ResultadoCancelacion
  /** Cambia el asiento de los trayectos pendientes de una reserva */
  cambiarAsientos: (pasajeroId: string, grupoId: string, cambios: CambioAsiento[]) => ResultadoEdicion
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
      sincronizarCuentas: (usuarios) => dispatch({ type: 'pasajero/desdeBd', usuarios }),
      sincronizarConductores: (conductores) => dispatch({ type: 'chofer/desdeBd', conductores }),
      aprobarSolicitud: (id, rol) => dispatch({ type: 'pasajero/aprobar', id, rol }),
      rechazarSolicitud: (id) => dispatch({ type: 'pasajero/rechazar', id }),
      eliminarPasajero: (id) => dispatch({ type: 'pasajero/eliminar', id }),
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
      cancelarReserva: (pasajeroId, grupoId) => {
        const actual = estadoActual.current
        const ids = cancelables(actual, pasajeroId, grupoId).map((r) => r.id)
        if (ids.length === 0) {
          return { ok: false, error: 'Esta reserva ya no se puede cancelar: el viaje ya salió o la reserva ya no está pendiente.' }
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
