import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useAdmin } from '../admin/store/AdminContext'
import { leerSesion } from '../login/sesion'
import { avisosConductor, type AvisoConductor } from './avisos'
import { useConductorActual } from './useConductorActual'

/**
 * Clave en avisos_leidos de un aviso del conductor. Los viajes y reservas de la base tienen ids `vbd<id>` y `rbd<id>`;
 * la tabla guarda `tipo:id` con el número (por ejemplo, "viaje-asignado:12"). Los avisos de ejemplo no tienen clave.
 */
export const claveAvisoConductor = (id: string) => {
  const m = /^([a-z-]+):[a-z]*bd(\d+)$/.exec(id)
  return m ? `${m[1]}:${m[2]}` : null
}

/**
 * Avisos del conductor y cuáles ya leyó.
 * #2905: lo leído se guarda en la base (GET y POST /api/avisos/leidos), no en el navegador; sin sesión del servidor
 * (pruebas y demostración) se recuerda solo mientras la página está abierta.
 */
export function useAvisosConductor() {
  const { state } = useAdmin()
  const { asignacion } = useConductorActual()
  const [leidos, setLeidos] = useState<string[]>([])

  useEffect(() => {
    if (!leerSesion()?.token) return
    let vigente = true
    api.avisosLeidos().then((r) => { if (vigente && r.ok) setLeidos(r.datos.leidos) })
    return () => { vigente = false }
  }, [])

  const leido = (id: string) => leidos.includes(id) || leidos.includes(claveAvisoConductor(id) ?? '')

  const avisos = useMemo(
    () => avisosConductor(state, asignacion).map((a): AvisoConductor & { leido: boolean } => ({ ...a, leido: leido(a.id) })),
    [state, asignacion, leidos],
  )

  // Se marca al tiro en pantalla y se guarda en la base.
  const marcar = (ids: string[]) => {
    const nuevos = ids.filter((id) => !leido(id))
    if (nuevos.length === 0) return
    const claves = nuevos.map((id) => claveAvisoConductor(id)).filter((c): c is string => c !== null)
    setLeidos([...leidos, ...nuevos, ...claves])
    if (claves.length > 0 && leerSesion()?.token) void api.marcarAvisosLeidos(claves)
  }

  return {
    avisos,
    sinLeer: avisos.filter((a) => !a.leido).length,
    marcarLeido: (id: string) => marcar([id]),
    marcarTodos: () => marcar(avisos.map((a) => a.id)),
  }
}
