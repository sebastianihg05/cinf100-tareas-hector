import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../store/AdminContext'
import { fechaDMY, fechaHora } from '../utils/format'

/** Panel de la campana: pasajeros por aprobar y viajes que iniciaron los conductores. */
export default function NotificacionesPanel({ onClose }: { onClose: () => void }) {
  const { state, pendientes, sinLeer, marcarLeida, marcarTodasLeidas, choferDeVan } = useAdmin()
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const ir = (to: string) => {
    navigate(to)
    onClose()
  }

  const vacio = pendientes === 0 && state.notificaciones.length === 0

  return (
    <>
      <div className="adm-notif-backdrop" onClick={onClose} />
      <div className="adm-notif" role="dialog" aria-label="Notificaciones">
        <header className="adm-notif__head">
          <h2>Notificaciones</h2>
          {sinLeer > 0 && <button onClick={marcarTodasLeidas}>Marcar como leídas</button>}
        </header>

        <ul className="adm-notif__list">
          {pendientes > 0 && (
            <li>
              <button className="adm-notif__item is-unread" onClick={() => ir('/admin/pasajeros?filtro=por-aprobar')}>
                <strong>{pendientes === 1 ? '1 pasajero por aprobar' : `${pendientes} pasajeros por aprobar`}</strong>
                <small>Revisa las cuentas nuevas que esperan aprobación.</small>
              </button>
            </li>
          )}

          {state.notificaciones.map((n) => {
            const viaje = state.viajes.find((v) => v.id === n.viajeId)
            const van = state.vans.find((v) => v.id === viaje?.vanId)
            const chofer = van && choferDeVan(van)
            return (
              <li key={n.id}>
                <button className={`adm-notif__item${n.leida ? '' : ' is-unread'}`}
                  onClick={() => { marcarLeida(n.id); ir('/admin/viajes') }}>
                  <strong>Viaje iniciado</strong>
                  {viaje && <small>{viaje.origen} → {viaje.destino} · {fechaDMY(viaje.fecha)} · {viaje.hora} hrs</small>}
                  <small>{[chofer?.nombre, van?.patente].filter(Boolean).join(' · ')}{chofer || van ? ' · ' : ''}{fechaHora(n.fecha)}</small>
                </button>
              </li>
            )
          })}

          {vacio && <li className="adm-empty">No tienes notificaciones.</li>}
        </ul>
      </div>
    </>
  )
}
