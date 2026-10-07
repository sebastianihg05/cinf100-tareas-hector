import { todayISO } from './format'

export type EstadoLicencia = 'vencida' | 'por-vencer' | 'ok'

/** yyyy-mm-dd de hoy + `dias` días */
function hoyMas(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Licencia vencida, por vencer (dentro de `diasAviso` días) o vigente. `iso` es yyyy-mm-dd. */
export function estadoLicencia(iso: string, diasAviso = 30): EstadoLicencia {
  if (iso <= todayISO()) return 'vencida'
  return iso <= hoyMas(diasAviso) ? 'por-vencer' : 'ok'
}
