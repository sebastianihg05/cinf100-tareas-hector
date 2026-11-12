import type { State } from '../admin/store/adminStore'
import { todayISO } from '../admin/utils/format'
import { fechaTexto } from '../pasajero/viajes'
import type { Asignacion } from './viajes'

/** Aviso para el conductor, calculado a partir de sus viajes y de las reservas de esos viajes. */
export type AvisoConductor = {
  id: string
  titulo: string
  lineas: string[]
  /** ISO yyyy-mm-ddThh:mm, para mostrarla y ordenar del más reciente al más antiguo */
  fecha: string
  /** viaje al que lleva el aviso */
  viajeId: string
}

const MAXIMO = 30

/**
 * Qué le avisa el panel al conductor, solo de sus viajes de hoy en adelante:
 * - "Viaje asignado": un viaje pendiente de su van.
 * - "Nueva reserva": un funcionario reservó un asiento en uno de sus viajes.
 * - "Reserva cancelada": un funcionario canceló su asiento.
 * - "Viaje cancelado": la administración canceló uno de sus viajes.
 * Cuando exista la API, esta lista vendrá del backend con la misma forma.
 */
export function avisosConductor(
  datos: Pick<State, 'reservas' | 'pasajeros'>,
  asignacion: Asignacion,
  hoy: string = todayISO(),
): AvisoConductor[] {
  const avisos: AvisoConductor[] = []

  for (const v of asignacion.viajes) {
    if (v.fecha < hoy) continue
    const salida = `${v.fecha}T${v.hora}`
    const ruta = `${v.trayecto}: ${v.origen} → ${v.destino} · ${v.hora} hrs`

    if (v.estado === 'cancelado') {
      avisos.push({ id: `viaje-cancelado:${v.id}`, titulo: 'Viaje cancelado', lineas: [fechaTexto(v.fecha), ruta], fecha: salida, viajeId: v.id })
      continue
    }
    if (v.estado === 'pendiente') {
      avisos.push({ id: `viaje-asignado:${v.id}`, titulo: 'Viaje asignado', lineas: [fechaTexto(v.fecha), ruta], fecha: salida, viajeId: v.id })
    }

    for (const r of datos.reservas) {
      if (r.viajeId !== v.id) continue
      const nombre = datos.pasajeros.find((p) => p.id === r.pasajeroId)?.nombre ?? 'Un pasajero'
      if (r.estado === 'pendiente') {
        avisos.push({
          id: `nueva-reserva:${r.id}`, titulo: 'Nueva reserva',
          lineas: [`${nombre} reservó el asiento #${r.asiento}`, `${fechaTexto(v.fecha)} · ${ruta}`],
          fecha: r.creadaEn, viajeId: v.id,
        })
      }
      if (r.estado === 'cancelada') {
        avisos.push({
          id: `reserva-cancelada:${r.id}`, titulo: 'Reserva cancelada',
          lineas: [`${nombre} liberó el asiento #${r.asiento}`, `${fechaTexto(v.fecha)} · ${ruta}`],
          fecha: salida, viajeId: v.id,
        })
      }
    }
  }

  return avisos.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAXIMO)
}
