import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../../api'
import { leerSesion } from '../../login/sesion'
import { useAdmin } from './AdminContext'

/** Cada cuánto se vuelven a pedir los viajes para ver lo que cambió otra persona (por ejemplo, el conductor). */
export const INTERVALO_SINCRONIZACION_MS = 15_000

export type EstadoViajesBd = {
  /** primera carga en curso: todavía no se sabe si la base tiene viajes */
  cargando: boolean
  /** mensaje de la última carga fallida; vacío si salió bien */
  error: string
  recargar: () => void
}

const SIN_SERVIDOR: EstadoViajesBd = { cargando: false, error: '', recargar: () => {} }
const Contexto = createContext<EstadoViajesBd>(SIN_SERVIDOR)

/** Estado de carga de los viajes guardados en PostgreSQL, para mostrar "Cargando…" o el error con "Reintentar". */
export const useEstadoViajesBd = () => useContext(Contexto)

/**
 * Carga los viajes desde la API al abrir el panel y los mantiene al día: cada 15 s, al volver a la pestaña y al
 * recuperar la conexión. `admin` trae todos; `conductor` solo los suyos. Sin sesión del servidor (sin token) no hace nada.
 */
export function ProveedorViajesBd({ rol, children }: { rol: 'admin' | 'conductor'; children: ReactNode }) {
  const { state, sincronizarViajes, sincronizarConductores, sincronizarVans, sincronizarCuentas } = useAdmin()
  const [cargando, setCargando] = useState(() => Boolean(leerSesion()?.token))
  const [error, setError] = useState('')

  // el id de la cuenta del conductor sale de su cuenta copiada al iniciar sesión
  const sesion = leerSesion()
  const conductorId = state.pasajeros.find((p) => p.id === sesion?.pasajeroId)?.idBd
  const ultimo = useRef({ conductorId, sincronizarViajes, sincronizarConductores, sincronizarVans, sincronizarCuentas })
  ultimo.current = { conductorId, sincronizarViajes, sincronizarConductores, sincronizarVans, sincronizarCuentas }
  const enCurso = useRef(false)

  const cargar = useCallback(async () => {
    if (!leerSesion()?.token || enCurso.current) {
      setCargando(false)
      return
    }
    enCurso.current = true
    // #2905: el conductor no tiene acceso a la lista de vans; su ficha y su van llegan de /api/conductor/perfil.
    // Se cargan antes que los viajes para que cada viaje encuentre su van.
    let idConductor = ultimo.current.conductorId
    if (rol === 'conductor') {
      const [perfil, cuenta] = await Promise.all([api.miPerfilConductor(), api.miPerfil()])
      if (cuenta.ok) ultimo.current.sincronizarCuentas([cuenta.datos.usuario])
      if (perfil.ok) {
        idConductor = perfil.datos.conductor.id
        ultimo.current.sincronizarConductores([perfil.datos.conductor])
        ultimo.current.sincronizarVans(perfil.datos.van ? [perfil.datos.van] : [])
      }
    }
    // el administrador también trae los conductores: sus cuentas reales son las que reciben los viajes que asigna
    const [r, conductores] = await Promise.all([
      rol === 'admin' ? api.listarViajes() : api.listarMisViajes(),
      rol === 'admin' ? api.listarConductores() : Promise.resolve(null),
    ])
    enCurso.current = false
    if (conductores?.ok) ultimo.current.sincronizarConductores(conductores.datos.conductores)
    if (r.ok) {
      const { sincronizarViajes: sincronizar } = ultimo.current
      sincronizar(r.datos.viajes, rol === 'admin' ? { tipo: 'todos' } : idConductor !== undefined ? { tipo: 'conductor', conductorId: idConductor } : { tipo: 'parcial' })
      setError('')
    } else {
      setError(r.error)
    }
    setCargando(false)
  }, [rol])

  useEffect(() => {
    let activo = true
    const seguro = () => { if (activo) void cargar() }
    seguro()
    const reloj = setInterval(seguro, INTERVALO_SINCRONIZACION_MS)
    const alVolver = () => { if (document.visibilityState === 'visible') seguro() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('online', seguro)
    return () => {
      activo = false
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('online', seguro)
    }
  }, [cargar])

  const valor = useMemo<EstadoViajesBd>(() => ({ cargando, error, recargar: () => void cargar() }), [cargando, error, cargar])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/** Aviso común de las pantallas de viajes: "Cargando…" durante la primera carga y el error con "Reintentar". */
export function AvisoViajesBd({ claseCarga = 'psj-alert psj-alert--suave', claseError = 'psj-alert', claseBoton = 'psj-link' }: {
  claseCarga?: string
  claseError?: string
  claseBoton?: string
}) {
  const { cargando, error, recargar } = useEstadoViajesBd()
  if (cargando) return <p className={claseCarga} role="status">Cargando viajes…</p>
  if (!error) return null
  return (
    <div className={claseError} role="alert">
      <p>{error}</p>
      <button type="button" className={claseBoton} onClick={recargar}>Reintentar</button>
    </div>
  )
}
