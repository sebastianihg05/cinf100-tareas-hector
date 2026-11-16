import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, type MiGrupoBd } from '../api'
import { avisosDe, type AvisoPasajero } from './avisos'

/** Cada cuánto se vuelven a pedir los avisos, para ver si el conductor inició o la administración canceló un viaje. */
const REFRESCO_MS = 60_000

/**
 * Avisos de la campana del funcionario (S3-RES-04, #2608). Todo sale de la base, nada queda en el navegador:
 * - los avisos, de sus reservas (GET /api/reservas);
 * - cuáles ya leyó, de la tabla avisos_leidos (GET y POST /api/avisos/leidos).
 */
export function useAvisosPasajero() {
  const { pathname } = useLocation()
  const [grupos, setGrupos] = useState<MiGrupoBd[]>([])
  const [leidos, setLeidos] = useState<string[]>([])

  // Se recargan al cambiar de pantalla (por ejemplo, después de reservar o cancelar) y cada minuto.
  useEffect(() => {
    let vigente = true
    const cargar = async () => {
      const [reservas, vistos] = await Promise.all([api.misReservas(), api.avisosLeidos()])
      if (!vigente) return
      if (reservas.ok) setGrupos(reservas.datos.grupos)
      if (vistos.ok) setLeidos(vistos.datos.leidos)
    }
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

  // Se marca al tiro en pantalla y se guarda en la base; la respuesta trae la lista completa de leídos.
  const marcar = async (ids: string[]) => {
    const nuevos = ids.filter((id) => !leidos.includes(id))
    if (nuevos.length === 0) return
    setLeidos([...leidos, ...nuevos])
    const r = await api.marcarAvisosLeidos(nuevos)
    if (r.ok) setLeidos(r.datos.leidos)
  }

  return {
    avisos,
    sinLeer: avisos.filter((a) => !a.leido).length,
    marcarLeido: (id: string) => void marcar([id]),
    marcarTodos: () => void marcar(avisos.map((a) => a.id)),
  }
}
