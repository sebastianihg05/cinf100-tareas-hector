import { useEffect, useState } from 'react'
import { api, type ViajeDisponibleBd } from '../api'
import { DIAS_MAX_ANTICIPACION, DIAS_MIN_ANTICIPACION, SEDES_ORIGEN, type Trayecto } from '../admin/types'
import { sumarDias, todayISO } from '../admin/utils/format'

export const CARGO_PASAJERO = 'Funcionario Docente'

/** Destino fijo institucional de la ida (y origen de la vuelta). */
export const DESTINO = 'Santiago'
export { SEDES_ORIGEN }

/** Primera y última fecha reservable (1 a 30 días desde hoy). */
export const ventanaReserva = () => ({
  desde: sumarDias(todayISO(), DIAS_MIN_ANTICIPACION),
  hasta: sumarDias(todayISO(), DIAS_MAX_ANTICIPACION),
})

export type Modalidad = 'Ida' | 'Vuelta' | 'IdaVuelta'
export const MODALIDADES: { valor: Modalidad; etiqueta: string }[] = [
  { valor: 'Ida', etiqueta: 'Ida' },
  { valor: 'Vuelta', etiqueta: 'Vuelta' },
  { valor: 'IdaVuelta', etiqueta: 'Ida y Vuelta' },
]

export const trayectosDe = (modalidad: Modalidad): Trayecto[] => (modalidad === 'IdaVuelta' ? ['Ida', 'Vuelta'] : [modalidad])

const CAMPUS: Record<string, string> = { Santiago: 'Campus Bellavista' }

/** "Santiago" -> "Santiago (Campus Bellavista)". No usa sedeLabel del admin, que tiene otros campus. */
export const destinoLabel = (sede: string) => (CAMPUS[sede] ? `${sede} (${CAMPUS[sede]})` : sede)

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** 2026-05-12 -> "12 de Mayo, 2026" */
export const fechaTexto = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2, '0')} de ${MESES[m - 1]}, ${y}`
}

/** Viajes de un mismo día: como máximo uno por trayecto. */
export type DiaViajes = Partial<Record<Trayecto, ViajeDisponibleBd>>

/**
 * Agrupa por fecha los viajes que el pasajero puede reservar desde su sede: los que tienen asientos libres
 * y en los que todavía no tiene reserva. La ida sale de la sede; la vuelta regresa a ella.
 */
export function agruparPorFecha(viajes: ViajeDisponibleBd[], sede: string): Map<string, DiaViajes> {
  const porFecha = new Map<string, DiaViajes>()
  for (const v of viajes) {
    if (v.libres <= 0 || v.tengoReserva) continue
    if ((v.trayecto === 'Ida' ? v.origen : v.destino) !== sede) continue
    const dia = porFecha.get(v.fecha) ?? {}
    if (!dia[v.trayecto]) dia[v.trayecto] = v
    porFecha.set(v.fecha, dia)
  }
  return porFecha
}

/** S3-RES-04 (#2608): viajes reservables desde la base (GET /api/viajes/disponibles), agrupados por fecha. */
export function useViajesSede(sede: string) {
  const [viajes, setViajes] = useState<ViajeDisponibleBd[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    api.viajesDisponibles().then((r) => {
      if (!vigente) return
      setCargando(false)
      if (r.ok) setViajes(r.datos.viajes)
      else setError(r.error)
    })
    // si se sale de la pantalla antes de la respuesta, no se actualiza nada
    return () => { vigente = false }
  }, [])

  return { porFecha: agruparPorFecha(viajes, sede), cargando, error }
}

/** Fechas (ordenadas) en las que existen todos los trayectos que exige la modalidad. */
export function fechasDisponibles(porFecha: Map<string, DiaViajes>, modalidad: Modalidad): string[] {
  const requeridos = trayectosDe(modalidad)
  const { desde, hasta } = ventanaReserva()
  return [...porFecha.entries()]
    .filter(([fecha, dia]) => fecha >= desde && fecha <= hasta && requeridos.every((t) => dia[t]))
    .map(([fecha]) => fecha)
    .sort()
}
