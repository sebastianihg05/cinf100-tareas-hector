import type { Datos } from '../admin/store/reservas'
import type { Reserva } from '../admin/types'
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
 * Qué le avisa la campana al funcionario:
 * - "Reserva confirmada": por cada reserva suya que sigue por viajar.
 * - "Tu viaje está en curso": el conductor ya inició un viaje que él reservó.
 * - "Viaje cancelado por la administración": se canceló un viaje que él había reservado
 *   (si canceló él mismo su reserva, no recibe aviso).
 */
export function avisosDe(datos: Pick<Datos, 'viajes' | 'reservas'>, pasajeroId: string): AvisoPasajero[] {
  const mias = datos.reservas.filter((r) => r.pasajeroId === pasajeroId)
  const avisos: AvisoPasajero[] = []

  const grupos = new Map<string, Reserva[]>()
  for (const r of mias) grupos.set(r.grupoId, [...(grupos.get(r.grupoId) ?? []), r])

  for (const [grupoId, reservas] of grupos) {
    if (!reservas.some((r) => r.estado === 'pendiente')) continue
    const ordenadas = [...reservas].sort((a, b) => (a.trayecto === b.trayecto ? 0 : a.trayecto === 'Ida' ? -1 : 1))
    const viaje = datos.viajes.find((v) => v.id === ordenadas[0].viajeId)
    avisos.push({
      id: `confirmada:${grupoId}`,
      titulo: 'Reserva confirmada',
      lineas: [
        ...(viaje ? [fechaTexto(viaje.fecha)] : []),
        ordenadas.map((r) => `Asiento #${r.asiento} (${r.trayecto})`).join(' / '),
      ],
      fecha: reservas.map((r) => r.creadaEn).sort()[0],
    })
  }

  for (const r of mias) {
    const viaje = datos.viajes.find((v) => v.id === r.viajeId)
    if (!viaje) continue
    const detalle = [fechaTexto(viaje.fecha), `${viaje.origen} → ${viaje.destino} · ${viaje.hora} hrs`, `Asiento #${r.asiento}`]
    const fecha = `${viaje.fecha}T${viaje.hora}`
    if (r.estado === 'pendiente' && viaje.estado === 'en-curso') {
      avisos.push({ id: `en-curso:${r.id}`, titulo: 'Tu viaje está en curso', lineas: detalle, fecha })
    }
    if (r.estado === 'cancelada' && viaje.estado === 'cancelado') {
      avisos.push({ id: `cancelado:${r.id}`, titulo: 'Viaje cancelado por la administración', lineas: detalle, fecha })
    }
  }

  return avisos.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAXIMO)
}
