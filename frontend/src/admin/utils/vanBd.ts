/**
 * Convierte el id de una van de la app en el número que guarda `viajes.van_id` (llave de la tabla `vans`).
 * - Las vans que vienen de la API ya traen su id de PostgreSQL como texto (`"1"`, `"7"`): se usa tal cual.
 * - Las vans de ejemplo usan `v1`, `v2`…: `v1` es 1, para que coincida con la van FG-1251 de los seeds.
 * - Cualquier otro id local produce siempre el mismo número entre 1 y 2.147.483.646 (máximo de un INTEGER);
 *   si no existe en `vans`, la API responde 400 y la pantalla muestra el motivo.
 */
export function numeroDeVan(id: string): number {
  if (/^\d{1,9}$/.test(id) && Number(id) > 0) return Number(id)
  const simple = /^v(\d{1,9})$/.exec(id)
  if (simple && Number(simple[1]) > 0) return Number(simple[1])
  let h = 0x811c9dc5 // FNV-1a de 32 bits
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return ((h >>> 0) % 2147483646) + 1
}
