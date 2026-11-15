import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type RutaBd } from '../api'
import { avanceEnRuta, medirRuta, type Avance } from './geo'
import type { Posicion } from './useSeguimientoGps'

/** Metros que el conductor puede alejarse de la ruta antes de pensar en recalcularla. */
export const UMBRAL_DESVIO_M = 200
/** Lecturas seguidas fuera de la ruta que se exigen, para no recalcular por un salto aislado del GPS. */
export const LECTURAS_DESVIO = 2
/** Tiempo mínimo entre dos cálculos automáticos (el backend además guarda su propio límite). */
export const INTERVALO_RECALCULO_MS = 30_000
/** Tiempo mínimo entre dos cálculos pedidos con el botón. */
export const INTERVALO_MANUAL_MS = 15_000
/** Espera antes de reintentar cuando el servicio de rutas falló. */
export const ESPERA_TRAS_ERROR_MS = 60_000

/**
 * Ruta hacia el destino del viaje y avance sobre ella (GPS-05 y GPS-06). Pide la ruta al backend la primera vez que
 * hay una posición y solo la recalcula si el conductor se aleja de ella; el avance (distancia y tiempo que faltan)
 * se calcula aquí con cada lectura, sin consultar al proveedor de mapas.
 */
export function useRutaGps(viajeIdBd: number | undefined, posicion: Posicion | null, activo: boolean) {
  const [ruta, setRuta] = useState<RutaBd | null>(null)
  const [error, setError] = useState('')
  const [calculando, setCalculando] = useState(false)
  const ultimoPedido = useRef(0)
  const esperaHasta = useRef(0)
  const enVuelo = useRef(false)
  const lecturasFuera = useRef(0)

  const medida = useMemo(() => (ruta ? medirRuta(ruta.coordenadas) : null), [ruta])
  const avance: Avance | null = useMemo(
    () => (posicion && medida ? avanceEnRuta([posicion.lat, posicion.lon], medida) : null),
    [posicion, medida],
  )

  const pedir = useCallback(async (p: Posicion) => {
    if (viajeIdBd === undefined || enVuelo.current) return
    enVuelo.current = true
    ultimoPedido.current = Date.now()
    setCalculando(true)
    const r = await api.calcularRuta(viajeIdBd, p.lat, p.lon)
    enVuelo.current = false
    setCalculando(false)
    if (r.ok) {
      setRuta(r.datos.ruta)
      setError('')
      lecturasFuera.current = 0
    } else {
      // sin ruta el mapa sigue mostrando la posición; se informa y se espera antes de volver a intentar
      setError(r.error)
      esperaHasta.current = Date.now() + ESPERA_TRAS_ERROR_MS
    }
  }, [viajeIdBd])

  // Primera ruta y recálculo por desvío
  useEffect(() => {
    if (!activo || !posicion) return
    if (viajeIdBd === undefined) {
      setError('La ruta solo se calcula para viajes guardados en el servidor.')
      return
    }
    const ahora = Date.now()
    if (ahora < esperaHasta.current) return

    if (!ruta) {
      void pedir(posicion)
      return
    }
    if (!avance) return
    lecturasFuera.current = avance.distanciaARutaM > UMBRAL_DESVIO_M ? lecturasFuera.current + 1 : 0
    if (lecturasFuera.current >= LECTURAS_DESVIO && ahora - ultimoPedido.current >= INTERVALO_RECALCULO_MS) {
      void pedir(posicion)
    }
  }, [activo, posicion, ruta, avance, viajeIdBd, pedir])

  /** Pedido manual ("Recalcular ruta"): respeta un intervalo mínimo para no saturar al proveedor. */
  const recalcular = useCallback(() => {
    if (!posicion) return
    if (Date.now() - ultimoPedido.current < INTERVALO_MANUAL_MS) {
      setError('Espera unos segundos antes de recalcular la ruta.')
      return
    }
    esperaHasta.current = 0
    void pedir(posicion)
  }, [posicion, pedir])

  return { ruta, avance, error, calculando, recalcular }
}
