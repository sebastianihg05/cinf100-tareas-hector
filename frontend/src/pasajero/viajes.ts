import { useMemo } from 'react'
import { asientosOcupados, capacidadDeViaje, estaActiva, yaSalio } from '../admin/store/reservas'
import { useAdmin } from '../admin/store/AdminContext'
import { usePasajeroActual } from '../login/usePasajeroActual'
import type { Trayecto, Viaje } from '../admin/types'

export const CARGO_PASAJERO = 'Funcionario Docente'

/** Destino fijo institucional de la ida (y origen de la vuelta). */
export const DESTINO = 'Santiago'
/** Origen fijo institucional: todos los viajes de ida salen de Quillota 980. */
export const SEDES_ORIGEN: string[] = ['Quillota 980']

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
export type DiaViajes = Partial<Record<Trayecto, Viaje>>

/**
 * Viajes que el pasajero puede reservar desde su sede, agrupados por fecha. Solo cuentan los pendientes que
 * aún no salen, con van asignada, con asientos libres y en los que el pasajero todavía no tiene reserva.
 * La ida sale de la sede; la vuelta regresa a ella.
 */
export function useViajesSede(sede: string): Map<string, DiaViajes> {
  const { state } = useAdmin()
  const { pasajeroId } = usePasajeroActual()
  return useMemo(() => {
    const porFecha = new Map<string, DiaViajes>()
    for (const v of state.viajes) {
      if (v.estado !== 'pendiente' || yaSalio(v)) continue
      if ((v.trayecto === 'Ida' ? v.origen : v.destino) !== sede) continue
      const capacidad = capacidadDeViaje(state, v)
      if (capacidad === undefined || asientosOcupados(state.reservas, v.id).length >= capacidad) continue
      if (state.reservas.some((r) => r.viajeId === v.id && r.pasajeroId === pasajeroId && estaActiva(r))) continue
      const dia = porFecha.get(v.fecha) ?? {}
      if (!dia[v.trayecto]) dia[v.trayecto] = v
      porFecha.set(v.fecha, dia)
    }
    return porFecha
  }, [state, sede, pasajeroId])
}

/** Fechas (ordenadas) en las que existen todos los trayectos que exige la modalidad. */
export function fechasDisponibles(porFecha: Map<string, DiaViajes>, modalidad: Modalidad): string[] {
  const requeridos = trayectosDe(modalidad)
  return [...porFecha.entries()]
    .filter(([, dia]) => requeridos.every((t) => dia[t]))
    .map(([fecha]) => fecha)
    .sort()
}
