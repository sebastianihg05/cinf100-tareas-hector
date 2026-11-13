/**
 * La base guarda la van de un viaje como el id de la tabla `vans` (`viajes.van_id`, 006_vans.sql); en la app las vans
 * todavía son locales, con ids de texto (`v1`, `vk3j9...`). Mientras el frontend no lea las vans desde la API, esta
 * conversión une ambas: `v1` es 1 (FG-1251 en la base de desarrollo) y los demás ids producen siempre el mismo número
 * entre 1 y 2.147.483.646. Si ese número no es una van activa de la tabla, el backend rechaza la asignación (400).
 */
export function numeroDeVan(id: string): number {
  const simple = /^v(\d{1,9})$/.exec(id)
  if (simple && Number(simple[1]) > 0) return Number(simple[1])
  let h = 0x811c9dc5 // FNV-1a de 32 bits
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return ((h >>> 0) % 2147483646) + 1
}
