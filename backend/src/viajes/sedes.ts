// Sedes de la ruta institucional. Copia de frontend/src/gps/sedesGps.ts (docs/gps/GPS-02): el backend decide
// el destino de la ruta, así el conductor no puede pedir una ruta hacia otro lugar.
export type Coordenadas = { latitud: number; longitud: number };

export const SEDES: Readonly<Record<string, Coordenadas>> = {
  'Quillota 980': { latitud: -33.013281, longitud: -71.541247 },
  Santiago: { latitud: -33.435172, longitud: -70.634 },
};

export function coordenadasDeSede(nombre: string): Coordenadas | undefined {
  return SEDES[nombre];
}
