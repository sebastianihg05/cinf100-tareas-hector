import { config } from '../config';
import type { Coordenadas } from './sedes';

// GPS-05 / GPS-06: ruta por carretera hacia la sede de destino, calculada con openrouteservice.
// El navegador nunca habla con el proveedor: pasa por aquí, que guarda la clave, limita las consultas
// y reutiliza respuestas recientes para respetar las condiciones de uso del servicio.

export type Ruta = {
  /** Puntos de la ruta como [latitud, longitud], listos para dibujar en el mapa. */
  coordenadas: [number, number][];
  distanciaM: number;
  duracionS: number;
};

export class ErrorRuta extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje);
  }
}

/** Un viaje no pide una ruta nueva antes de este tiempo (la anterior se reutiliza si es la misma). */
export const INTERVALO_MIN_MS = 15_000;
/** Una ruta calculada sirve para posiciones casi iguales durante este tiempo. */
export const VIGENCIA_MS = 60_000;
/** Tope de consultas al proveedor por minuto, entre todos los conductores (el plan gratuito permite 40). */
export const MAX_POR_MINUTO = 30;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

let fetcher: Fetcher = (url, init) => fetch(url, init);
const recientes = new Map<string, { en: number; ruta: Ruta }>();
const ultimaConsulta = new Map<number, number>();
let consultas: number[] = [];

/** Solo para pruebas: reemplaza la llamada al proveedor y borra lo guardado. */
export function configurarProveedor(nuevo?: Fetcher) {
  fetcher = nuevo ?? ((url, init) => fetch(url, init));
  recientes.clear();
  ultimaConsulta.clear();
  consultas = [];
}

// Posiciones a ~110 m comparten ruta: evita una consulta por cada actualización del GPS.
const clave = (viajeId: number, o: Coordenadas) => `${viajeId}:${o.latitud.toFixed(3)},${o.longitud.toFixed(3)}`;

export async function rutaHaciaDestino(viajeId: number, origen: Coordenadas, destino: Coordenadas): Promise<Ruta> {
  const ahora = Date.now();
  const k = clave(viajeId, origen);
  const guardada = recientes.get(k);
  if (guardada && ahora - guardada.en < VIGENCIA_MS) return guardada.ruta;

  if (!config.orsApiKey) {
    throw new ErrorRuta(503, 'El servicio de rutas no está configurado. El mapa sigue mostrando tu posición.');
  }
  const anterior = ultimaConsulta.get(viajeId);
  if (anterior !== undefined && ahora - anterior < INTERVALO_MIN_MS) {
    throw new ErrorRuta(429, 'Espera unos segundos antes de recalcular la ruta.');
  }
  consultas = consultas.filter((t) => ahora - t < 60_000);
  if (consultas.length >= MAX_POR_MINUTO) {
    throw new ErrorRuta(429, 'El servicio de rutas está ocupado. Inténtalo en un minuto.');
  }
  ultimaConsulta.set(viajeId, ahora);
  consultas.push(ahora);

  let respuesta: Response;
  try {
    respuesta = await fetcher(config.orsUrl, {
      method: 'POST',
      headers: { Authorization: config.orsApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: [
          [origen.longitud, origen.latitud],
          [destino.longitud, destino.latitud],
        ],
        geometry_simplify: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ErrorRuta(504, 'El servicio de rutas no respondió a tiempo.');
  }
  if (!respuesta.ok) {
    throw new ErrorRuta(502, 'El servicio de rutas no pudo calcular el recorrido.');
  }

  const datos = (await respuesta.json().catch(() => null)) as {
    features?: { geometry?: { coordinates?: [number, number][] }; properties?: { summary?: { distance?: number; duration?: number } } }[];
  } | null;
  const ruta = datos?.features?.[0];
  const puntos = ruta?.geometry?.coordinates;
  const resumen = ruta?.properties?.summary;
  if (!puntos?.length || typeof resumen?.distance !== 'number' || typeof resumen?.duration !== 'number') {
    throw new ErrorRuta(502, 'El servicio de rutas devolvió una respuesta incompleta.');
  }

  const resultado: Ruta = {
    coordenadas: puntos.map(([longitud, latitud]) => [latitud, longitud]),
    distanciaM: Math.round(resumen.distance),
    duracionS: Math.round(resumen.duration),
  };
  recientes.set(k, { en: ahora, ruta: resultado });
  return resultado;
}
