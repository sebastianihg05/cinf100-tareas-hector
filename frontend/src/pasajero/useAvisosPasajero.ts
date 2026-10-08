import { useMemo, useState } from 'react'
import { useAdmin } from '../admin/store/AdminContext'
import { usePasajeroActual } from '../login/usePasajeroActual'
import { avisosDe, type AvisoPasajero } from './avisos'

const clave = (pasajeroId: string) => `unab-avisos-leidos-${pasajeroId}`

function leer(pasajeroId: string): string[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(clave(pasajeroId)) ?? '[]')
    return Array.isArray(guardado) ? guardado.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Borra lo que se recordaba de los avisos leídos de una cuenta eliminada. */
export function borrarAvisosLeidos(pasajeroId: string): void {
  try {
    localStorage.removeItem(clave(pasajeroId))
  } catch {
    /* ignorar */
  }
}

/** Avisos de la campana del funcionario y cuáles ya leyó (se recuerda en el navegador, por persona). */
export function useAvisosPasajero() {
  const { state } = useAdmin()
  const { pasajeroId } = usePasajeroActual()
  const [leidos, setLeidos] = useState<string[]>(() => leer(pasajeroId))

  const avisos = useMemo(
    () => avisosDe(state, pasajeroId).map((a): AvisoPasajero & { leido: boolean } => ({ ...a, leido: leidos.includes(a.id) })),
    [state, pasajeroId, leidos],
  )

  const guardar = (ids: string[]) => {
    setLeidos(ids)
    try {
      localStorage.setItem(clave(pasajeroId), JSON.stringify(ids))
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
