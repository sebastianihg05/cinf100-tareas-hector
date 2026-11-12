import { useNavigate, useOutletContext } from 'react-router-dom'
import { IconClock } from '../../admin/components/icons'
import { fechaHora } from '../../admin/utils/format'
import AnimatedContent from '../../reactbits/AnimatedContent'
import { ENTRADA_TARJETAS } from '../../reactbits/unab'
import type { useAvisosConductor } from '../useAvisosConductor'
import { motivoSinViajes, useConductorActual } from '../useConductorActual'

export type AvisosDelConductor = ReturnType<typeof useAvisosConductor>

/** Notificaciones del conductor: la más reciente primero, con las no leídas destacadas. */
export default function NotificacionesConductor() {
  const { chofer, van } = useConductorActual()
  const { avisos, sinLeer, marcarLeido, marcarTodos } = useOutletContext<AvisosDelConductor>()
  const navigate = useNavigate()
  const sinAsignacion = motivoSinViajes({ chofer, van })

  const abrir = (id: string, viajeId: string) => {
    marcarLeido(id)
    navigate(`/conductor/viajes/${viajeId}`, { state: { desde: 'avisos' } })
  }

  if (sinAsignacion) return <div className="psj-page"><p className="psj-alert psj-alert--suave" role="status">{sinAsignacion}</p></div>
  if (avisos.length === 0) return <div className="psj-page"><div className="psj-vacio"><p>No tienes notificaciones.</p></div></div>

  return (
    <div className="psj-page">
      <div className="cnd-avisos__barra">
        <p className="cnd-resumen">{sinLeer === 0 ? 'Todas leídas' : sinLeer === 1 ? '1 sin leer' : `${sinLeer} sin leer`}</p>
        {sinLeer > 0 && <button type="button" className="cnd-avisos__marcar" onClick={marcarTodos}>Marcar todas como leídas</button>}
      </div>
      <AnimatedContent as="ul" className="psj-lista" {...ENTRADA_TARJETAS}>
        {avisos.map((a) => (
          <li key={a.id}>
            <button type="button" className={`psj-card cnd-aviso${a.leido ? '' : ' is-unread'}`} onClick={() => abrir(a.id, a.viajeId)}>
              <span className="psj-reserva__head">
                <strong className="cnd-aviso__titulo">{a.titulo}</strong>
                <span className={`psj-badge ${a.leido ? 'cnd-badge--leida' : 'cnd-badge--nueva'}`}>{a.leido ? 'Leída' : 'Nueva'}</span>
              </span>
              {a.lineas.map((l) => <span key={l} className="cnd-aviso__linea">{l}</span>)}
              <span className="psj-reserva__linea"><IconClock size={14} />{fechaHora(a.fecha)}</span>
            </button>
          </li>
        ))}
      </AnimatedContent>
    </div>
  )
}
