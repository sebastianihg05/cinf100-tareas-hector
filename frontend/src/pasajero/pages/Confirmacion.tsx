import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAdmin } from '../../admin/store/AdminContext'
import { usePasajeroActual } from '../../login/usePasajeroActual'
import { DESTINO, destinoLabel } from '../viajes'

export default function Confirmacion() {
  const { reservasDe } = useAdmin()
  const { pasajero, pasajeroId } = usePasajeroActual()
  const grupoId = (useLocation().state as { grupoId?: unknown } | null)?.grupoId
  const { proximas, historial } = reservasDe(pasajeroId)
  const grupo = typeof grupoId === 'string' ? [...proximas, ...historial].find((g) => g.grupoId === grupoId) : undefined
  if (!grupo) return <Navigate to="/pasajero/reservas" replace />

  const nombre = pasajero?.nombre ?? 'Funcionario'
  const ida = grupo.trayectos.find((t) => t.reserva.trayecto === 'Ida')?.viaje
  const vuelta = grupo.trayectos.find((t) => t.reserva.trayecto === 'Vuelta')?.viaje
  const sedeOrigen = ida?.origen ?? vuelta?.destino ?? '—'

  return (
    <div className="psj-page">
      <section className="psj-exito">
        <div className="psj-exito__icon" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16 9.8" />
          </svg>
        </div>
        <h2 className="psj-exito__title">¡Reserva Confirmada!</h2>
        <p className="psj-exito__sub">Tu viaje ha sido agendado con éxito</p>
      </section>

      <section className="psj-card">
        <h3 className="psj-card__title">Detalles del Pasajero</h3>
        <dl className="psj-detalle">
          <div><dt>Nombre:</dt><dd>{nombre}</dd></div>
          <div><dt>Sede Origen:</dt><dd>{sedeOrigen}</dd></div>
          <div><dt>Sede Destino:</dt><dd>{destinoLabel(DESTINO)}</dd></div>
        </dl>

        <h3 className="psj-card__title psj-card__title--sep">Itinerario y Asientos</h3>
        <ul className="psj-itinerario">
          {grupo.trayectos.map(({ reserva, viaje }) => (
            <li key={reserva.id}>
              <span className={`psj-tramo psj-tramo--${reserva.trayecto.toLowerCase()}`} aria-hidden="true">{reserva.trayecto[0]}</span>
              <span className="psj-itinerario__text">{reserva.trayecto} — {viaje?.hora ?? '—'} hrs</span>
              <span className={`psj-pill psj-pill--${reserva.trayecto.toLowerCase()}`}>
                {reserva.estado === 'cancelada' ? 'Cancelado' : `Asiento #${reserva.asiento}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="psj-acciones">
        <Link to="/pasajero/reservas" className="psj-btn psj-btn--primary">Ver Mis Reservas</Link>
        <Link to="/pasajero/reservar" className="psj-btn psj-btn--secondary">Volver al Inicio</Link>
      </div>
    </div>
  )
}
