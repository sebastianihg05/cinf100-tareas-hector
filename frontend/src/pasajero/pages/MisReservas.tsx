import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconClock, IconSeat } from '../../admin/components/icons'
import { useAdmin } from '../../admin/store/AdminContext'
import type { GrupoReserva } from '../../admin/store/reservas'
import type { EstadoReserva } from '../../admin/types'
import { PASAJERO_ID, fechaTexto } from '../viajes'

const ESTADO: Record<EstadoReserva, { texto: string; clase: string }> = {
  pendiente: { texto: 'Pendiente', clase: 'psj-badge--pendiente' },
  completada: { texto: 'Completado', clase: 'psj-badge--completado' },
  cancelada: { texto: 'Cancelado', clase: 'psj-badge--cancelado' },
}

function TarjetaReserva({ grupo }: { grupo: GrupoReserva }) {
  const conViaje = grupo.trayectos.find((t) => t.viaje)?.viaje
  const cancelados = grupo.trayectos.filter((t) => t.reserva.estado === 'cancelada')
  const parcial = cancelados.length > 0 && cancelados.length < grupo.trayectos.length
  const estado = ESTADO[grupo.estado]
  return (
    <li className="psj-card psj-reserva">
      <div className="psj-reserva__head">
        <p className="psj-reserva__fecha">{grupo.fecha ? fechaTexto(grupo.fecha) : 'Fecha no disponible'}</p>
        <span className={`psj-badge ${estado.clase}`}>{estado.texto}</span>
      </div>
      <p className="psj-reserva__ruta">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
        </svg>
        {conViaje ? `${conViaje.origen} → ${conViaje.destino}` : 'Ruta no disponible'}
      </p>
      <p className="psj-reserva__linea">
        <IconClock size={14} />
        {grupo.trayectos.map((t) => `${t.viaje?.hora ?? '—'} hrs`).join(' / ')}
      </p>
      <p className="psj-reserva__linea">
        <IconSeat size={14} />
        {grupo.estado === 'cancelada'
          ? 'Asientos: Cancelado'
          : `Asientos: ${grupo.trayectos.map((t) => `#${t.reserva.asiento} (${t.reserva.trayecto}${t.reserva.estado === 'cancelada' ? ', cancelado' : ''})`).join(' / ')}`}
      </p>
      {parcial && (
        <p className="psj-reserva__parcial">
          {cancelados.map((t) => t.reserva.trayecto).join(' y ')} cancelada; el resto de la reserva se mantiene.
        </p>
      )}
    </li>
  )
}

export default function MisReservas() {
  const { reservasDe } = useAdmin()
  const { proximas, historial } = reservasDe(PASAJERO_ID)
  const [pestana, setPestana] = useState<'proximas' | 'historial'>('proximas')
  const lista = pestana === 'proximas' ? proximas : historial

  return (
    <div className="psj-page psj-page--nav">
      <div className="psj-tabs" role="tablist" aria-label="Mis reservas">
        <button type="button" role="tab" id="psj-tab-proximas" aria-selected={pestana === 'proximas'} aria-controls="psj-panel-reservas"
          className={`psj-tab${pestana === 'proximas' ? ' is-active' : ''}`} onClick={() => setPestana('proximas')}>Próximas</button>
        <button type="button" role="tab" id="psj-tab-historial" aria-selected={pestana === 'historial'} aria-controls="psj-panel-reservas"
          className={`psj-tab${pestana === 'historial' ? ' is-active' : ''}`} onClick={() => setPestana('historial')}>Historial</button>
      </div>

      <div id="psj-panel-reservas" role="tabpanel" aria-labelledby={`psj-tab-${pestana}`}>
        {lista.length === 0 ? (
          <div className="psj-vacio">
            <p>{pestana === 'proximas' ? 'No tienes reservas próximas.' : 'Aún no tienes viajes en tu historial.'}</p>
            {pestana === 'proximas' && <Link to="/pasajero/reservar" className="psj-link">Reservar un asiento</Link>}
          </div>
        ) : (
          <ul className="psj-lista">
            {lista.map((g) => <TarjetaReserva key={g.grupoId} grupo={g} />)}
          </ul>
        )}
      </div>
    </div>
  )
}
