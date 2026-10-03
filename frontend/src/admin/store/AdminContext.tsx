import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { Admin, Chofer, EstadoViaje, Pasajero, Van, Viaje } from '../types'
import { ahoraISO } from '../utils/format'
import { cargarEstado, guardarEstado, nuevoId, reducer, type State } from './adminStore'

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
}

const AdminContext = createContext<AdminApi | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, cargarEstado)

  useEffect(() => guardarEstado(state), [state])

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
