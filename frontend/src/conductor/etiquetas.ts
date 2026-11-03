import type { EstadoViaje } from '../admin/types'

/** Texto y clase (psj-badge) de cada estado de viaje. Lo usan el listado, el detalle y el historial. */
export const ESTADO_VIAJE: Record<EstadoViaje, { texto: string; clase: string }> = {
  pendiente: { texto: 'Pendiente', clase: 'psj-badge--pendiente' },
  'en-curso': { texto: 'En curso', clase: 'psj-badge--en-curso' },
  completado: { texto: 'Completado', clase: 'psj-badge--completado' },
  cancelado: { texto: 'Cancelado', clase: 'psj-badge--cancelado' },
}
