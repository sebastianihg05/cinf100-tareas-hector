import { Link } from 'react-router-dom'
import { IconClock, IconSeat, IconTruck } from '../../admin/components/icons'
import { useAdmin } from '../../admin/store/AdminContext'
import type { Viaje } from '../../admin/types'
import { fechaTexto } from '../../pasajero/viajes'
import { ESTADO_VIAJE } from '../etiquetas'
import { motivoSinViajes, useConductorActual } from '../useConductorActual'
import { pasajerosDelViaje } from '../viajes'
import AnimatedContent from '../../reactbits/AnimatedContent'
import { ENTRADA_TARJETAS } from '../../reactbits/unab'

function TarjetaFinalizado({ viaje, patente, pasajeros }: { viaje: Viaje; patente: string; pasajeros: number }) {
  const estado = ESTADO_VIAJE[viaje.estado]
  return (
    <li>
      {/* `state.desde` hace que la flecha "volver" del detalle regrese al historial */}
      <Link to={`/conductor/viajes/${viaje.id}`} state={{ desde: 'historial' }} className="psj-card psj-reserva cnd-viaje cnd-viaje--enlace"
        aria-label={`Ver el detalle del viaje del ${fechaTexto(viaje.fecha)}, ${viaje.trayecto} de las ${viaje.hora}`}>
        <div className="psj-reserva__head">
          <p className="psj-reserva__fecha">{fechaTexto(viaje.fecha)}</p>
          <span className={`psj-badge ${estado.clase}`}>{estado.texto}</span>
        </div>
        <p className="psj-reserva__ruta">{viaje.trayecto}: {viaje.origen} → {viaje.destino}</p>
        <p className="psj-reserva__linea"><IconClock size={14} />{viaje.hora} hrs</p>
        <p className="psj-reserva__linea"><IconTruck size={14} />Van {patente}</p>
        <p className="psj-reserva__linea"><IconSeat size={14} />Pasajeros transportados: {pasajeros}</p>
      </Link>
    </li>
  )
}

/** Historial del conductor: solo los viajes que ya finalizó (estado Completado), del más reciente al más antiguo. */
export default function HistorialViajes() {
  const { state } = useAdmin()
  const { chofer, van, finalizados } = useConductorActual()
  const sinAsignacion = motivoSinViajes({ chofer, van })

  return (
    <div className="psj-page">
      {sinAsignacion ? (
        <p className="psj-alert psj-alert--suave" role="status">{sinAsignacion}</p>
      ) : finalizados.length === 0 ? (
        <div className="psj-vacio"><p>Aún no tienes viajes finalizados.</p></div>
      ) : (
        <>
          <p className="cnd-resumen">
            {finalizados.length === 1 ? '1 viaje finalizado' : `${finalizados.length} viajes finalizados`}
          </p>
          <AnimatedContent as="ul" className="psj-lista" {...ENTRADA_TARJETAS}>
            {finalizados.map((v) => (
              <TarjetaFinalizado key={v.id} viaje={v} patente={van!.patente} pasajeros={pasajerosDelViaje(state, v.id).length} />
            ))}
          </AnimatedContent>
        </>
      )}
    </div>
  )
}
