import { useCallback, useEffect, useRef, useState } from 'react'

/** Qué pasa con la ubicación del dispositivo (GPS-04). */
export type EstadoGps =
  | 'solicitando' // esperando el permiso o la primera lectura
  | 'activo' // llegan posiciones
  | 'sin-senal' // el dispositivo no puede ubicarse o dejó de enviar posiciones
  | 'denegado' // la persona rechazó el permiso de ubicación
  | 'sin-soporte' // el navegador no tiene geolocalización

export type Posicion = { lat: number; lon: number; precisionM: number; marca: number }

/** Sin una lectura nueva durante este tiempo se considera que se perdió la señal. */
export const SENAL_PERDIDA_MS = 30_000

export const MENSAJES_GPS: Record<EstadoGps, string> = {
  solicitando: 'Permite el acceso a tu ubicación para ver tu posición en el mapa.',
  activo: 'GPS activo.',
  'sin-senal': 'Sin señal GPS. Seguimos intentando ubicarte; mira el cielo despejado o revisa que la ubicación esté activada.',
  denegado: 'No tenemos permiso para usar tu ubicación. Actívalo en la configuración del navegador y vuelve a intentarlo.',
  'sin-soporte': 'Este dispositivo o navegador no permite usar la ubicación.',
}

/**
 * Sigue la ubicación del dispositivo con `watchPosition` mientras `activo` sea verdadero. Al pasar a falso
 * (o al salir de la pantalla) deja de consultarla. Los errores no detienen el panel: solo cambian el estado.
 */
export function useSeguimientoGps(activo: boolean) {
  const [estado, setEstado] = useState<EstadoGps>('solicitando')
  const [posicion, setPosicion] = useState<Posicion | null>(null)
  const [intento, setIntento] = useState(0)
  const ultimaLectura = useRef(0)

  useEffect(() => {
    if (!activo) return
    if (!('geolocation' in navigator) || !navigator.geolocation) {
      setEstado('sin-soporte')
      return
    }

    setEstado('solicitando')
    ultimaLectura.current = Date.now()
    const id = navigator.geolocation.watchPosition(
      (p) => {
        ultimaLectura.current = Date.now()
        setPosicion({ lat: p.coords.latitude, lon: p.coords.longitude, precisionM: p.coords.accuracy, marca: p.timestamp })
        setEstado('activo')
      },
      (error) => {
        if (error.code === 1) {
          // permiso rechazado: el navegador no volverá a avisar, así que se deja de esperar
          navigator.geolocation.clearWatch(id)
          setEstado('denegado')
        } else {
          setEstado('sin-senal')
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )

    // el navegador puede dejar de enviar posiciones sin avisar (túnel, señal débil): se detecta por el tiempo
    const reloj = setInterval(() => {
      if (Date.now() - ultimaLectura.current > SENAL_PERDIDA_MS) setEstado((e) => (e === 'activo' ? 'sin-senal' : e))
    }, 5_000)

    return () => {
      navigator.geolocation.clearWatch(id)
      clearInterval(reloj)
    }
  }, [activo, intento])

  /** Vuelve a pedir la ubicación (por ejemplo, después de dar el permiso). */
  const reintentar = useCallback(() => setIntento((n) => n + 1), [])

  return { estado, posicion, mensaje: MENSAJES_GPS[estado], reintentar }
}
