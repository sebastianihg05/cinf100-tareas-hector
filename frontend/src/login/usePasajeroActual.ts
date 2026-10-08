import { useAdmin } from '../admin/store/AdminContext'
import { leerSesion } from './sesion'


export function usePasajeroActual() {
  const { state } = useAdmin()
  const pasajeroId = leerSesion()?.pasajeroId ?? ''
  return { pasajeroId, pasajero: state.pasajeros.find((p) => p.id === pasajeroId) }
}
