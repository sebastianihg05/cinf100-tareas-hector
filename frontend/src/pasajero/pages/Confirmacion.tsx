import { Link, Navigate, useLocation } from 'react-router-dom'
import type { ReservaCreadaBd } from '../../api'
import { leerSesion } from '../../login/sesion'
import { useMiCuenta } from '../useMiCuenta'
import { DESTINO, destinoLabel } from '../viajes'
import ShinyText from '../../reactbits/ShinyText'
import { UNAB } from '../../reactbits/unab'

export default function Confirmacion() {
  const { cuenta } = useMiCuenta()
  // S3-RES-04 (#2608): la reserva que respondió POST /api/reservas, enviada por la selección de asiento.
  const reserva = (useLocation().state as { reserva?: { grupoId: string; reservas: ReservaCreadaBd[] } } | null)?.reserva
  if (!reserva || !Array.isArray(reserva.reservas) || reserva.reservas.length === 0) return <Navigate to="/pasajero/reservas" replace />

  const nombre = cuenta?.nombre ?? leerSesion()?.nombre ?? 'Funcionario'
  const ida = reserva.reservas.find((r) => r.trayecto === 'Ida')
  const vuelta = reserva.reservas.find((r) => r.trayecto === 'Vuelta')
  const sedeOrigen = ida?.origen ?? vuelta?.destino ?? '—'

  return (
    <div className="psj-page">
      <section className="psj-exito">
        <div className="psj-exito__icon" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16 9.8" />
          </svg>
        </div>
        {/* RB-05: brillo que cruza el título (React Bits ShinyText) */}
        <h2 className="psj-exito__title"><ShinyText text="¡Reserva Confirmada!" color={UNAB.navy} shineColor={UNAB.navyClaro} speed={2.5} /></h2>
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
          {[ida, vuelta].filter((r) => r !== undefined).map((r) => (
            <li key={r.id}>
              <span className={`psj-tramo psj-tramo--${r.trayecto.toLowerCase()}`} aria-hidden="true">{r.trayecto[0]}</span>
              <span className="psj-itinerario__text">{r.trayecto} — {r.hora} hrs</span>
              <span className={`psj-pill psj-pill--${r.trayecto.toLowerCase()}`}>Asiento #{r.asiento}</span>
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
