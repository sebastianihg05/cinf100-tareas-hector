import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, type MiGrupoBd } from '../api'
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

/** Cada cuánto se vuelven a pedir las reservas, para ver si el conductor inició o la administración canceló un viaje. */
const REFRESCO_MS = 60_000

/**
 * Avisos de la campana del funcionario. Salen de sus reservas en la base (GET /api/reservas, #2608);
 * en el navegador solo se recuerda cuáles ya leyó, por persona.
 */
export function useAvisosPasajero() {
  const { pasajeroId } = usePasajeroActual()
  const { pathname } = useLocation()
  const [grupos, setGrupos] = useState<MiGrupoBd[]>([])
  const [leidos, setLeidos] = useState<string[]>(() => leer(pasajeroId))

  // Se recargan al cambiar de pantalla (por ejemplo, después de reservar o cancelar) y cada minuto.
  useEffect(() => {
    let vigente = true
    const cargar = () => api.misReservas().then((r) => { if (vigente && r.ok) setGrupos(r.datos.grupos) })
    void cargar()
    const temporizador = setInterval(() => void cargar(), REFRESCO_MS)
    return () => {
      vigente = false
      clearInterval(temporizador)
    }
  }, [pathname])

  const avisos = useMemo(
    () => avisosDe(grupos).map((a): AvisoPasajero & { leido: boolean } => ({ ...a, leido: leidos.includes(a.id) })),
    [grupos, leidos],
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
