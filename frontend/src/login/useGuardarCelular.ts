import { api } from '../api'
import { useAdmin } from '../admin/store/AdminContext'
import { leerSesion } from './sesion'

/**
 * Guarda el celular de quien inició sesión: primero en la base (PATCH /api/usuarios/me) y después en la app.
 * Las cuentas de ejemplo sin token solo se guardan en la app. Devuelve un mensaje si el backend lo rechaza.
 */
export function useGuardarCelular() {
  const { sincronizarCuentas } = useAdmin()

  return async (celular: string, guardarEnApp: () => void): Promise<string | void> => {
    if (!leerSesion()?.token) {
      guardarEnApp()
      return
    }
    const r = await api.actualizarMiCelular(celular)
    if (!r.ok) return r.error
    guardarEnApp()
    // actualiza la cuenta en Pasajeros y, si es conductor, también en Choferes
    sincronizarCuentas([r.datos.usuario])
  }
}
