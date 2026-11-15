import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { Punto } from './geo'
import type { Posicion } from './useSeguimientoGps'

export type DestinoMapa = { lat: number; lon: number; nombre: string }

type Props = {
  posicion: Posicion | null
  destino: DestinoMapa
  /** puntos de la ruta [latitud, longitud]; `null` mientras no hay ruta calculada */
  ruta: readonly Punto[] | null
  /** el mapa acompaña a la posición; se apaga cuando la persona mueve el mapa con el dedo */
  seguir: boolean
  onSoltar: () => void
}

// Marcadores dibujados con CSS (clases cnd-marcador*): no dependen de imágenes que el empaquetador pueda perder.
const iconoPosicion = L.divIcon({ className: 'cnd-marcador cnd-marcador--yo', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] })
const iconoDestino = L.divIcon({ className: 'cnd-marcador cnd-marcador--destino', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 30] })

/** Enmarca la ruta completa la primera vez y después acompaña a la posición mientras `seguir` esté activo. */
function Vista({ posicion, destino, ruta, seguir, onSoltar }: Props) {
  const mapa = useMap()
  useMapEvents({ dragstart: onSoltar })

  const rutaTexto = ruta ? `${ruta.length}:${ruta[0]?.join(',')}` : ''
  useEffect(() => {
    // el recuadro cambia cuando llega una ruta nueva o la primera posición
    const puntos: L.LatLngTuple[] = ruta?.length ? ruta.map((p) => [p[0], p[1]]) : [[destino.lat, destino.lon]]
    if (posicion) puntos.push([posicion.lat, posicion.lon])
    mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 16, animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, rutaTexto, destino.lat, destino.lon, posicion === null])

  useEffect(() => {
    if (seguir && posicion) mapa.setView([posicion.lat, posicion.lon], Math.max(mapa.getZoom(), 15), { animate: true })
  }, [mapa, seguir, posicion])

  return null
}

/** Mapa de la navegación (GPS-03): posición actual, sede de destino y ruta, sobre teselas de OpenStreetMap. */
export default function MapaNavegacion(props: Props) {
  const { posicion, destino, ruta } = props
  const linea = useMemo<L.LatLngTuple[]>(() => (ruta ? ruta.map((p) => [p[0], p[1]]) : []), [ruta])

  return (
    <div className="cnd-mapa__marco" role="region" aria-label="Mapa de navegación">
    <MapContainer className="cnd-mapa" center={[destino.lat, destino.lon]} zoom={9} zoomControl={false} attributionControl>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      {linea.length > 1 && <Polyline positions={linea} pathOptions={{ color: '#003366', weight: 6, opacity: 0.85 }} />}
      <Marker position={[destino.lat, destino.lon]} icon={iconoDestino} title={`Destino: ${destino.nombre}`} />
      {posicion && <Marker position={[posicion.lat, posicion.lon]} icon={iconoPosicion} title="Tu posición" />}
      <Vista {...props} />
    </MapContainer>
    </div>
  )
}
