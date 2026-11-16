import type { MiGrupoBd } from '../api'
import { fechaTexto } from './viajes'

/** Aviso para el funcionario, calculado a partir de sus reservas y del estado de sus viajes. */
export type AvisoPasajero = {
  id: string
  titulo: string
  lineas: string[]
  /** ISO yyyy-mm-ddThh:mm, para ordenar del más reciente al más antiguo */
  fecha: string
}

const MAXIMO = 20

/**
 * Qué le avisa la campana al funcionario, con sus reservas de la base (GET /api/reservas, #2608):
 * - "Reserva confirmada": por cada reserva suya que sigue por viajar.
 * - "Tu viaje está en curso": el conductor ya inició un viaje que él reservó.
 * - "Viaje cancelado por la administración": se canceló un viaje que él había reservado
 *   (si canceló él mismo su reserva, el viaje sigue pendiente y no recibe aviso).
 */
export function avisosDe(grupos: MiGrupoBd[]): AvisoPasajero[] {
  const avisos: AvisoPasajero[] = []

  for (const { grupoId, reservas } of grupos) {
    if (!reservas.some((r) => r.estado === 'pendiente')) continue
    const ordenadas = [...reservas].sort((a, b) => (a.trayecto === b.trayecto ? 0 : a.trayecto === 'Ida' ? -1 : 1))
    avisos.push({
      id: `confirmada:${grupoId}`,
      titulo: 'Reserva confirmada',
      lineas: [fechaTexto(ordenadas[0].fecha), ordenadas.map((r) => `Asiento #${r.asiento} (${r.trayecto})`).join(' / ')],
      fecha: reservas.map((r) => r.creadaEn).sort()[0],
    })
  }

  for (const r of grupos.flatMap((g) => g.reservas)) {
    const detalle = [fechaTexto(r.fecha), `${r.origen} → ${r.destino} · ${r.hora} hrs`, `Asiento #${r.asiento}`]
    const fecha = `${r.fecha}T${r.hora}`
    if (r.estado === 'pendiente' && r.estadoViaje === 'en-curso') {
      avisos.push({ id: `en-curso:${r.id}`, titulo: 'Tu viaje está en curso', lineas: detalle, fecha })
    }
    if (r.estado === 'cancelada' && r.estadoViaje === 'cancelado') {
      avisos.push({ id: `cancelado:${r.id}`, titulo: 'Viaje cancelado por la administración', lineas: detalle, fecha })
    }
  }

  return avisos.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAXIMO)
}
