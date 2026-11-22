import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ConfirmDialog from '../../admin/components/ConfirmDialog'
import { useAdmin } from '../../admin/store/AdminContext'
import { AvisoViajesBd } from '../../admin/store/useViajesBd'
import { fechaCorta } from '../../admin/utils/format'
import { fechaTexto } from '../../pasajero/viajes'
import FadeContent from '../../reactbits/FadeContent'
import HoldButton from '../../reactbits/HoldButton'
import SloshGauge from '../../reactbits/SloshGauge'
import { UNAB } from '../../reactbits/unab'
import PasajerosViaje from '../components/PasajerosViaje'
import TrayectosDelDia from '../components/TrayectosDelDia'
import { ESTADO_VIAJE } from '../etiquetas'
import { motivoSinViajes, useConductorActual } from '../useConductorActual'
import { pasajerosDelViaje, trayectosDelDia, viajeAsignado, viajeEnCurso } from '../viajes'

/**
 * Detalle de un viaje asignado al conductor: resumen, trayectos del día y pasajeros con su asiento.
 * Ruta: /conductor/viajes/:viajeId (solo abre viajes de la van del conductor).
 */
export default function ViajeDetalle() {
  const { viajeId } = useParams()
  const { state, cambiarEstadoViaje } = useAdmin()
  const [confirmandoInicio, setConfirmandoInicio] = useState(false)
  const [confirmandoFinalizacion, setConfirmandoFinalizacion] = useState(false)
  // S3-CON-02: iniciar y finalizar se guardan en PostgreSQL; mientras responde no se repite la acción y, si falla, se avisa
  const [procesando, setProcesando] = useState(false)
  const [errorEstado, setErrorEstado] = useState('')

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

  const cambiarEstado = async (estado: 'en-curso' | 'completado') => {
    if (procesando) return
    setProcesando(true)
    setErrorEstado('')
    const resultado = await cambiarEstadoViaje(viaje.id, estado)
    setProcesando(false)
    if (!resultado.ok) setErrorEstado(resultado.error)
  }

  return (
    <div className="psj-page">
      <AvisoViajesBd />
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
            <div className="adm-form__actions cnd-detalle__acciones">
              {/* RB-06: mantener presionado inicia el viaje (React Bits HoldButton); un toque o el teclado abren la confirmación */}
              <HoldButton backgroundColor={UNAB.navy} fillColor={UNAB.rojo} textColor={UNAB.blanco} fillTextColor={UNAB.blanco}
                holdTime={900} doneLabel="¡En marcha!" disabled={!!bloqueado || procesando}
                onHold={() => void cambiarEstado('en-curso')} onTap={() => setConfirmandoInicio(true)}>
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
          {/* GPS-07: la navegación se habilita solo con el viaje En curso */}
          {viaje.estado === 'en-curso' && (
            <Link to={`/conductor/viajes/${viaje.id}/navegacion`} className="psj-btn psj-btn--secondary cnd-ir-navegacion">
              Abrir navegación
            </Link>
          )}
          {viaje.estado === 'en-curso' && (
            <div className="adm-form__actions cnd-detalle__acciones">
              <HoldButton backgroundColor={UNAB.navy} fillColor={UNAB.rojo} textColor={UNAB.blanco} fillTextColor={UNAB.blanco}
                holdTime={900} doneLabel="¡Viaje completado!" disabled={procesando}
                onHold={() => void cambiarEstado('completado')} onTap={() => setConfirmandoFinalizacion(true)}>
                Finalizar viaje
              </HoldButton>
            </div>
          )}
          {errorEstado && <p className="psj-alert" role="alert">{errorEstado}</p>}
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
            setConfirmandoInicio(false)
            void cambiarEstado('en-curso')
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
            setConfirmandoFinalizacion(false)
            void cambiarEstado('completado')
          }}
        />
      )}
    </div>
  )
}
