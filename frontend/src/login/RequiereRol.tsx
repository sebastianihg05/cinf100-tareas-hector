import { Navigate, Outlet } from 'react-router-dom'
import { leerSesion, RUTA_INICIO, type RolSesion } from './sesion'

/** Protege un grupo de rutas: sin sesión va a /login; con otro rol, a la pantalla de inicio de su rol. */
export default function RequiereRol({ rol }: { rol: RolSesion }) {
  const sesion = leerSesion()
  if (!sesion) return <Navigate to="/login" replace />
  if (sesion.rol !== rol) return <Navigate to={RUTA_INICIO[sesion.rol]} replace />
  return <Outlet />
}
