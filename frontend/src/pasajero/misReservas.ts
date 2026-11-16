import { useCallback, useEffect, useState } from 'react'
import { api, type MiGrupoBd, type MiTrayectoBd } from '../api'
import type { EstadoReserva } from '../admin/types'
import { todayISO } from '../admin/utils/format'

/** S3-RES-04 (#2608): una reserva de "Mis reservas", armada con lo que responde GET /api/reservas. */
export type GrupoMio = {
  grupoId: string
  /** fecha del viaje (yyyy-mm-dd) */
  fecha: string
  hora: string
  estado: EstadoReserva
  /** la ida antes que la vuelta */
  trayectos: MiTrayectoBd[]
}

// Pendiente si queda algún trayecto por viajar; si no, completada si viajó alguno; si no, cancelada.
function estadoDelGrupo(trayectos: MiTrayectoBd[]): EstadoReserva {
  if (trayectos.some((t) => t.estado === 'pendiente')) return 'pendiente'
  if (trayectos.some((t) => t.estado === 'completada')) return 'completada'
  return 'cancelada'
}

const clave = (g: GrupoMio) => `${g.fecha} ${g.hora}`

/** Separa las reservas en "Próximas" (por viajar, de la más cercana) e "Historial" (de la más reciente). */
export function agruparMisReservas(grupos: MiGrupoBd[], hoy: string = todayISO()) {
  const lista: GrupoMio[] = grupos.map(({ grupoId, reservas }) => {
    const trayectos = [...reservas].sort((a, b) => (a.trayecto === b.trayecto ? 0 : a.trayecto === 'Ida' ? -1 : 1))
    return { grupoId, fecha: trayectos[0].fecha, hora: trayectos[0].hora, estado: estadoDelGrupo(trayectos), trayectos }
  })
  const proximas = lista
    .filter((g) => g.estado === 'pendiente' && g.fecha >= hoy)
    .sort((a, b) => clave(a).localeCompare(clave(b)))
  const historial = lista
    .filter((g) => !proximas.includes(g))
    .sort((a, b) => clave(b).localeCompare(clave(a)))
  return { proximas, historial }
}

/** Trayectos que todavía se pueden cancelar o cambiar de asiento (lo decide el backend). */
export const editables = (grupo: GrupoMio) => grupo.trayectos.filter((t) => t.editable)

/** Reservas del funcionario desde la base; `recargar` se llama después de cancelar o editar. */
export function useMisReservas() {
  const [grupos, setGrupos] = useState<MiGrupoBd[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const recargar = useCallback(async () => {
    const r = await api.misReservas()
    setCargando(false)
    if (r.ok) {
      setGrupos(r.datos.grupos)
      setError('')
    } else {
      setError(r.error)
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { ...agruparMisReservas(grupos), cargando, error, recargar }
}
