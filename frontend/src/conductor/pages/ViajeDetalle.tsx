import { Link, useParams } from 'react-router-dom'
import { fechaCorta } from '../../admin/utils/format'
import { fechaTexto } from '../../pasajero/viajes'
import PasajerosViaje from '../components/PasajerosViaje'
import TrayectosDelDia from '../components/TrayectosDelDia'
import { ESTADO_VIAJE } from '../etiquetas'
import { useAdmin } from '../../admin/store/AdminContext'
import { motivoSinViajes, useConductorActual } from '../useConductorActual'
import { pasajerosDelViaje, trayectosDelDia, viajeAsignado, viajeEnCurso } from '../viajes'
import { useState } from 'react'
import ConfirmDialog from '../../admin/components/ConfirmDialog'
import FadeContent from '../../reactbits/FadeContent'
import HoldButton from '../../reactbits/HoldButton'
import SloshGauge from '../../reactbits/SloshGauge'
import { UNAB } from '../../reactbits/unab'
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
  // otro viaje de la van que sigue en curso: hay que finalizarlo antes de iniciar este
  const otroEnCurso = viajeEnCurso(asignacion)
  const bloqueado = otroEnCurso && otroEnCurso.id !== viaje.id ? otroEnCurso : undefined

  return (
    <div className="psj-page">
      {/* RB-05: al iniciar o finalizar, el resumen vuelve a aparecer con desenfoque para marcar el cambio de estado */}
      <FadeContent key={viaje.estado} trigger="mount" blur duration={0.5}>
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
        {/* RB-05: ocupación de la van como líquido (React Bits SloshGauge) */}
        <div className="cnd-ocupacion">
          <SloshGauge value={van.asientos ? Math.round((viaje.reservados / van.asientos) * 100) : 0} interactive={false}
            liquidColor={UNAB.navy} glassColor="#e6ebf1" width={56} height={84} radius={14} unit="%"
            ariaLabel={`Ocupación de la van: ${viaje.reservados} de ${van.asientos} asientos`} />
          <span>Ocupación de la van</span>
        </div>

        {viaje.estado === 'pendiente' && (
            <div className="adm-form__actions">
                {/* RB-06: mantener presionado inicia el viaje (React Bits HoldButton); un toque o el teclado abren la confirmación */}
                <HoldButton backgroundColor={UNAB.navy} fillColor={UNAB.rojo} textColor={UNAB.blanco} fillTextColor={UNAB.blanco}
                    holdTime={900} doneLabel="¡En marcha!" disabled={!!bloqueado}
                    onHold={() => setEstadoViaje(viaje.id, 'en-curso')} onTap={() => setConfirmandoInicio(true)}>
                    Iniciar viaje
                </HoldButton>
            </div>
        )}
        {viaje.estado === 'pendiente' && bloqueado && (
          <p id="cnd-bloqueo" className="psj-alert psj-alert--suave" role="status">
            Tienes un viaje en curso ({bloqueado.trayecto} de las {bloqueado.hora} hrs).{' '}
            <Link to={`/conductor/viajes/${bloqueado.id}`} className="psj-link">Finalízalo</Link> antes de iniciar este.
          </p>
        )}
        {viaje.estado === 'en-curso' && (
            <div className="adm-form__actions">
                <HoldButton backgroundColor={UNAB.navy} fillColor={UNAB.rojo} textColor={UNAB.blanco} fillTextColor={UNAB.blanco}
                    holdTime={900} doneLabel="¡Viaje completado!"
                    onHold={() => setEstadoViaje(viaje.id, 'completado')} onTap={() => setConfirmandoFinalizacion(true)}>
                    Finalizar viaje
                </HoldButton>
            </div>  
        )}

      </section>
      </FadeContent>

      <section className="psj-card" aria-label="Trayectos del día">
        <h2 className="psj-card__title">Trayectos del {fechaCorta(viaje.fecha)}</h2>
        <TrayectosDelDia trayectos={trayectos} actualId={viaje.id} pasajerosPorViaje={pasajerosPorViaje} />
      </section>

      <section className="psj-card" aria-label="Pasajeros del viaje">
        <h2 className="psj-card__title">Pasajeros ({pasajeros.length})</h2>
        <PasajerosViaje pasajeros={pasajeros} />
      </section>

      {confirmandoInicio && !bloqueado && (
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
