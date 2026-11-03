import { Link, useParams } from 'react-router-dom'
import { fechaCorta } from '../../admin/utils/format'
import { fechaTexto } from '../../pasajero/viajes'
import PasajerosViaje from '../components/PasajerosViaje'
import TrayectosDelDia from '../components/TrayectosDelDia'
import { ESTADO_VIAJE } from '../etiquetas'
import { useAdmin } from '../../admin/store/AdminContext'
import { motivoSinViajes, useConductorActual } from '../useConductorActual'
import { pasajerosDelViaje, trayectosDelDia, viajeAsignado } from '../viajes'

/**
 * Detalle de un viaje asignado al conductor: resumen, trayectos del día y pasajeros con su asiento.
 * Ruta: /conductor/viajes/:viajeId (solo abre viajes de la van del conductor).
 */
export default function ViajeDetalle() {
  const { viajeId } = useParams()
  const { state } = useAdmin()
  const { asignacion, van } = useConductorActual()
  const viaje = viajeAsignado(asignacion, viajeId)

  if (!viaje || !van) {
    return (
      <div className="psj-page">
        <p className="psj-alert" role="alert">
          {motivoSinViajes(asignacion) || 'No encontramos este viaje entre los que tienes asignados.'}
        </p>
        <Link to="/conductor/viajes" className="psj-link">Ir a mis viajes</Link>
      </div>
    )
  }

  const estado = ESTADO_VIAJE[viaje.estado]
  const pasajeros = pasajerosDelViaje(state, viaje.id)
  const trayectos = trayectosDelDia(asignacion, viaje)
  const pasajerosPorViaje = Object.fromEntries(trayectos.map((t) => [t.id, pasajerosDelViaje(state, t.id).length]))

  return (
    <div className="psj-page">
      <section className="psj-card" aria-label="Resumen del viaje">
        <div className="psj-reserva__head">
          <h2 className="psj-card__title cnd-titulo">{viaje.trayecto}: {viaje.origen} → {viaje.destino}</h2>
          <span className={`psj-badge ${estado.clase}`}>{estado.texto}</span>
        </div>
        <dl className="psj-detalle">
          <div><dt>Fecha:</dt><dd>{fechaTexto(viaje.fecha)}</dd></div>
          <div><dt>Hora de salida:</dt><dd>{viaje.hora} hrs</dd></div>
          <div><dt>Van:</dt><dd>{van.patente}</dd></div>
          <div><dt>Asientos reservados:</dt><dd>{viaje.reservados}/{van.asientos}</dd></div>
        </dl>
        {/* Aquí irán los botones de iniciar y finalizar el viaje (#1861 y #1864). */}
      </section>

      <section className="psj-card" aria-label="Trayectos del día">
        <h2 className="psj-card__title">Trayectos del {fechaCorta(viaje.fecha)}</h2>
        <TrayectosDelDia trayectos={trayectos} actualId={viaje.id} pasajerosPorViaje={pasajerosPorViaje} />
      </section>

      <section className="psj-card" aria-label="Pasajeros del viaje">
        <h2 className="psj-card__title">Pasajeros ({pasajeros.length})</h2>
        <PasajerosViaje pasajeros={pasajeros} />
      </section>
    </div>
  )
}
