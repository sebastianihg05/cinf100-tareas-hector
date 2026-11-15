import { lazy, Suspense, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../../admin/components/ConfirmDialog'
import { useAdmin } from '../../admin/store/AdminContext'
import type { Viaje } from '../../admin/types'
import { distanciaM, duracionRestanteS, formatearDistancia, formatearDuracion, horaLlegada } from '../../gps/geo'
import { resolverRutaGps, type SedeGps } from '../../gps/sedesGps'
import { useRutaGps } from '../../gps/useRutaGps'
import { useSeguimientoGps, type EstadoGps } from '../../gps/useSeguimientoGps'
import { motivoSinViajes, useConductorActual } from '../useConductorActual'
import { viajeAsignado } from '../viajes'

// El mapa (Leaflet) se descarga solo al abrir la navegación: el resto del panel no carga ese peso.
const MapaNavegacion = lazy(() => import('../../gps/MapaNavegacion'))

const ETIQUETA_GPS: Record<EstadoGps, string> = {
  solicitando: 'Buscando tu ubicación…',
  activo: 'GPS activo',
  'sin-senal': 'Sin señal GPS',
  denegado: 'Ubicación no permitida',
  'sin-soporte': 'Ubicación no disponible',
}

/**
 * Pantalla de navegación del conductor (GPS-03 a GPS-07). Solo se abre para un viaje propio En curso; si el viaje
 * termina o se cancela mientras está abierta, el seguimiento se detiene y se vuelve al detalle del viaje.
 */
export default function NavegacionViaje() {
  const { viajeId } = useParams()
  const { asignacion } = useConductorActual()
  const viaje = viajeAsignado(asignacion, viajeId)
  const estuvoEnCurso = useRef(false)

  if (!viaje) {
    return (
      <div className="psj-page">
        <p className="psj-alert" role="alert">
          {motivoSinViajes(asignacion) || 'No encontramos este viaje entre los que tienes asignados.'}
        </p>
        <Link to="/conductor/viajes" className="psj-link">Ir a mis viajes</Link>
      </div>
    )
  }

  if (viaje.estado === 'en-curso') estuvoEnCurso.current = true
  // el recorrido terminó (o se canceló) con la pantalla abierta: se vuelve al detalle, que muestra el estado final
  if (viaje.estado !== 'en-curso' && estuvoEnCurso.current) return <Navigate to={`/conductor/viajes/${viaje.id}`} replace />

  if (viaje.estado !== 'en-curso') {
    return (
      <div className="psj-page">
        <p className="psj-alert psj-alert--suave" role="alert">
          La navegación solo está disponible mientras el viaje está en curso.
          {viaje.estado === 'pendiente' ? ' Inicia el viaje para habilitarla.' : ''}
        </p>
        <Link to={`/conductor/viajes/${viaje.id}`} className="psj-link">Volver al viaje</Link>
      </div>
    )
  }

  const trayecto = resolverRutaGps(viaje)
  if (!trayecto.ok) {
    return (
      <div className="psj-page">
        <p className="psj-alert" role="alert">{trayecto.error}</p>
        <Link to={`/conductor/viajes/${viaje.id}`} className="psj-link">Volver al viaje</Link>
      </div>
    )
  }
  return <Navegacion viaje={viaje} destino={trayecto.destino} />
}

function Navegacion({ viaje, destino }: { viaje: Viaje; destino: SedeGps }) {
  const { cambiarEstadoViaje } = useAdmin()
  // mientras esta pantalla está montada y el viaje En curso, se sigue la ubicación; al salir se detiene
  const { estado, posicion, mensaje, reintentar } = useSeguimientoGps(true)
  const { ruta, avance, error: errorRuta, calculando, recalcular } = useRutaGps(viaje.idBd, posicion, true)
  const [seguir, setSeguir] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [errorFin, setErrorFin] = useState('')

  // Distancia: la de la ruta si existe y, si no, la línea recta al destino (aproximada).
  const enLinea = posicion ? distanciaM([posicion.lat, posicion.lon], [destino.latitud, destino.longitud]) : null
  const restanteM = avance?.restanteM ?? enLinea
  const restanteS = ruta && avance ? duracionRestanteS(avance.restanteM, ruta) : null

  const finalizar = async () => {
    setConfirmando(false)
    setProcesando(true)
    setErrorFin('')
    const r = await cambiarEstadoViaje(viaje.id, 'completado')
    setProcesando(false)
    if (!r.ok) setErrorFin(r.error)
  }

  return (
    <div className="cnd-nav">
      <div className="cnd-nav__mapa">
        <Suspense fallback={<p className="cnd-nav__cargando" role="status">Cargando mapa…</p>}>
          <MapaNavegacion
            posicion={posicion}
            destino={{ lat: destino.latitud, lon: destino.longitud, nombre: destino.nombre }}
            ruta={ruta?.coordenadas ?? null}
            seguir={seguir}
            onSoltar={() => setSeguir(false)}
          />
        </Suspense>
        {!seguir && posicion && (
          <button type="button" className="cnd-nav__centrar" onClick={() => setSeguir(true)}>Centrar en mi posición</button>
        )}
      </div>

      <section className="cnd-nav__panel" aria-label="Progreso del viaje">
        <div className="cnd-nav__destino">
          <p className="cnd-nav__etiqueta">Destino</p>
          <h2 className="cnd-nav__nombre">{viaje.destino} · {destino.nombre}</h2>
          <p className="cnd-nav__direccion">{destino.direccion}</p>
        </div>

        <dl className="cnd-nav__datos">
          <div>
            <dt>Distancia restante</dt>
            <dd>{restanteM === null ? '—' : `${ruta ? '' : '≈ '}${formatearDistancia(restanteM)}`}</dd>
          </div>
          <div>
            <dt>Llegada estimada</dt>
            <dd>{restanteS === null ? '—' : horaLlegada(Date.now(), restanteS)}</dd>
          </div>
          <div>
            <dt>Tiempo restante</dt>
            <dd>{restanteS === null ? '—' : formatearDuracion(restanteS)}</dd>
          </div>
        </dl>

        <p className={`cnd-nav__gps cnd-nav__gps--${estado}`} role="status" aria-live="polite">
          <span className="cnd-nav__punto" aria-hidden="true" />
          {ETIQUETA_GPS[estado]}
        </p>
        {estado !== 'activo' && estado !== 'solicitando' && <p className="psj-alert psj-alert--suave" role="alert">{mensaje}</p>}
        {errorRuta && <p className="psj-alert psj-alert--suave" role="alert">No pudimos calcular la ruta: {errorRuta}</p>}
        {calculando && <p className="cnd-nav__nota" role="status">Calculando ruta…</p>}
        {errorFin && <p className="psj-alert" role="alert">{errorFin}</p>}

        <div className="cnd-nav__acciones">
          {(estado === 'denegado' || estado === 'sin-senal') && (
            <button type="button" className="psj-btn psj-btn--secondary" onClick={reintentar}>Reintentar ubicación</button>
          )}
          <button type="button" className="psj-btn psj-btn--secondary" onClick={recalcular} disabled={!posicion || calculando}>Recalcular ruta</button>
          <Link to={`/conductor/viajes/${viaje.id}`} className="psj-btn psj-btn--secondary">Volver al viaje</Link>
          <button type="button" className="psj-btn psj-btn--primary" onClick={() => setConfirmando(true)} disabled={procesando}>Finalizar viaje</button>
        </div>
      </section>

      {confirmando && (
        <ConfirmDialog
          title="Completar viaje"
          message={`¿Confirmas que se ha completado el viaje ${viaje.origen} → ${viaje.destino}?`}
          confirmLabel="Completar viaje"
          onCancel={() => setConfirmando(false)}
          onConfirm={() => void finalizar()}
        />
      )}
    </div>
  )
}
