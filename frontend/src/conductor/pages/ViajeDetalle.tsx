import { Link, useParams } from 'react-router-dom'
import { fechaCorta } from '../../admin/utils/format'
import { fechaTexto } from '../../pasajero/viajes'
import PasajerosViaje from '../components/PasajerosViaje'
import TrayectosDelDia from '../components/TrayectosDelDia'
import { ESTADO_VIAJE } from '../etiquetas'
import { useAdmin } from '../../admin/store/AdminContext'
import { motivoSinViajes, useConductorActual } from '../useConductorActual'
import { pasajerosDelViaje, trayectosDelDia, viajeAsignado } from '../viajes'
import { useState } from 'react'
import ConfirmDialog from '../../admin/components/ConfirmDialog'
/**
 * Detalle de un viaje asignado al conductor: resumen, trayectos del día y pasajeros con su asiento.
 * Ruta: /conductor/viajes/:viajeId (solo abre viajes de la van del conductor).
 */
export default function ViajeDetalle() {
  const { viajeId } = useParams()
    const { state, setEstadoViaje } = useAdmin()
    const [confirmandoInicio, setConfirmandoInicio] = useState(false)
    const [confirmandoFinalizacion, setConfirmandoFinalizacion] = useState(false)

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

        {viaje.estado === 'pendiente' && (
            <div className="adm-form__actions">
                <button
                    type="button"
                    className="adm-btn"
                    onClick={() => setConfirmandoInicio(true)}
                >
                    Iniciar viaje
                </button>
            </div>
        )}
        {viaje.estado === 'en-curso' && (
            <div className="adm-form__actions">
                <button
                    type="button"
                    className="adm-btn"
                    onClick={() => setConfirmandoFinalizacion(true)}
                >
                    Finalizar viaje
                </button>
            </div>  
        )}

      </section>

      <section className="psj-card" aria-label="Trayectos del día">
        <h2 className="psj-card__title">Trayectos del {fechaCorta(viaje.fecha)}</h2>
        <TrayectosDelDia trayectos={trayectos} actualId={viaje.id} pasajerosPorViaje={pasajerosPorViaje} />
      </section>

      <section className="psj-card" aria-label="Pasajeros del viaje">
        <h2 className="psj-card__title">Pasajeros ({pasajeros.length})</h2>
        <PasajerosViaje pasajeros={pasajeros} />
      </section>

      {confirmandoInicio && (
        <ConfirmDialog
            title="Iniciar viaje"
            message={`¿Confirmas el inicio del viaje ${viaje.origen} → ${viaje.destino}?`}
            confirmLabel="Confirmar inicio"
            onCancel={() => setConfirmandoInicio(false)}
            onConfirm={() => {
                setEstadoViaje(viaje.id, 'en-curso')
                setConfirmandoInicio(false)
            }}
        />
      )}
      {confirmandoFinalizacion && (
        <ConfirmDialog
            title="Completar viaje"
            message={`¿Confirmas que se ha completado el viaje ${viaje.origen} → ${viaje.destino}?`}
            confirmLabel="Completar viaje"
            onCancel={() => setConfirmandoFinalizacion(false)}
            onConfirm={() => {
                setEstadoViaje(viaje.id, 'completado')
                setConfirmandoFinalizacion(false)
            }}
        />
      )}

    </div>
  )
}
