import { useMemo, useState } from 'react'
import { useAdmin } from '../admin/store/AdminContext'
import { avisosConductor, type AvisoConductor } from './avisos'
import { useConductorActual } from './useConductorActual'

const clave = (correo: string) => `unab-avisos-conductor-${correo.trim().toLowerCase()}`

function leer(correo: string): string[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(clave(correo)) ?? '[]')
    return Array.isArray(guardado) ? guardado.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Avisos del conductor y cuáles ya leyó.
 * Por ahora lo leído se recuerda en el navegador, igual que en la campana del funcionario;
 * con el backend, `leer` y `guardar` pasan a ser llamadas a la API.
 */
export function useAvisosConductor() {
  const { state } = useAdmin()
  const { correo, asignacion } = useConductorActual()
  const [leidos, setLeidos] = useState<string[]>(() => leer(correo))

  const avisos = useMemo(
    () => avisosConductor(state, asignacion).map((a): AvisoConductor & { leido: boolean } => ({ ...a, leido: leidos.includes(a.id) })),
    [state, asignacion, leidos],
  )

  const guardar = (ids: string[]) => {
    setLeidos(ids)
    try {
      localStorage.setItem(clave(correo), JSON.stringify(ids))
    } catch {
      /* sin almacenamiento: se recuerda solo mientras la página esté abierta */
    }
  }

  return {
    avisos,
    sinLeer: avisos.filter((a) => !a.leido).length,
    marcarLeido: (id: string) => { if (!leidos.includes(id)) guardar([...leidos, id]) },
    marcarTodos: () => guardar([...new Set([...leidos, ...avisos.map((a) => a.id)])]),
  }
}
