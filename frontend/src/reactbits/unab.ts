/** Colores UNAB para los componentes de React Bits: los que dibujan en canvas no leen variables CSS. Mismos valores que styles/global.css. */
export const UNAB = { navy: '#003366', navyClaro: '#7fb2e5', rojo: '#cc0033', blanco: '#ffffff' } as const

/** Entrada de tarjetas y listas: suben 40 px y crecen un poco, una tras otra al aparecer en pantalla (AnimatedContent). */
export const ENTRADA_TARJETAS = { distance: 40, duration: 0.7, stagger: 0.1, scale: 0.96, threshold: 0.05 } as const
