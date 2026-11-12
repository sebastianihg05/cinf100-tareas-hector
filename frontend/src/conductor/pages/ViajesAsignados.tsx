import { Link, useSearchParams } from 'react-router-dom'
import { IconClock, IconSeat, IconTruck } from '../../admin/components/icons'
import type { Viaje } from '../../admin/types'
import { iniciales, todayISO } from '../../admin/utils/format'
import { fechaTexto } from '../../pasajero/viajes'
import { ESTADO_VIAJE } from '../etiquetas'
import { motivoSinViajes, useConductorActual } from '../useConductorActual'
import AnimatedContent from '../../reactbits/AnimatedContent'
import { ENTRADA_TARJETAS } from '../../reactbits/unab'

function TarjetaViaje({ viaje, capacidad, desdeHistorial }: { viaje: Viaje; capacidad: number; desdeHistorial: boolean }) {
  const estado = ESTADO_VIAJE[viaje.estado]
  const esHoy = viaje.fecha === todayISO()
  return (
    <li>
      {/* Toda la tarjeta lleva al detalle del viaje (/conductor/viajes/:viajeId) */}
      <Link to={`/conductor/viajes/${viaje.id}`}
        state={desdeHistorial ? { desde: 'listado-historial' } : undefined}
        className={`psj-card psj-reserva cnd-viaje cnd-viaje--enlace${viaje.estado === 'cancelado' ? ' is-cancelado' : ''}`}
        aria-label={`Ver el detalle del viaje del ${fechaTexto(viaje.fecha)}, ${viaje.trayecto} de las ${viaje.hora}`}>
        <div className="psj-reserva__head">
          <p className="psj-reserva__fecha">
            {fechaTexto(viaje.fecha)}
            {esHoy && <span className="cnd-viaje__hoy">Hoy</span>}
          </p>
          <span className={`psj-badge ${estado.clase}`}>{estado.texto}</span>
        </div>
        <p className="psj-reserva__ruta">{viaje.trayecto}: {viaje.origen} → {viaje.destino}</p>
        <p className="psj-reserva__linea"><IconClock size={14} />{viaje.hora} hrs</p>
        <p className="psj-reserva__linea"><IconSeat size={14} />Asientos reservados: {viaje.reservados}/{capacidad}</p>
      </Link>
    </li>
  )
}

/** Listado de los viajes que la administración asignó al conductor (por su van). */
export default function ViajesAsignados() {
  const { nombre, chofer, van, proximos, historial } = useConductorActual()
  // La pestaña se conserva en la URL para restaurarla al volver del detalle.
  const [parametros, cambiarParametros] = useSearchParams()
  const pestana = parametros.get('tab') === 'historial' ? 'historial' : 'proximos'
  const elegirPestana = (seleccion: 'proximos' | 'historial') => {
    const siguientes = new URLSearchParams(parametros)
    if (seleccion === 'historial') siguientes.set('tab', 'historial')
    else siguientes.delete('tab')
    cambiarParametros(siguientes)
  }
  const lista = pestana === 'proximos' ? proximos : historial

  // Sin van no hay viajes: se explica por qué para que sepa a quién acudir.
  const sinAsignacion = motivoSinViajes({ chofer, van })

  return (
    <div className="psj-page">
      <div className="psj-user">
        <div className="psj-user__info">
          <div className="psj-avatar">{iniciales(nombre)}</div>
          <div>
            <p className="psj-user__name">Hola, {nombre.split(' ')[0] || 'conductor'}</p>
            <p className="psj-user__sub">
              {van ? <><IconTruck size={12} /> Van {van.patente} · {van.asientos} asientos</> : 'Sin van asignada'}
            </p>
          </div>
        </div>
      </div>

      <div className="psj-tabs" role="tablist" aria-label="Mis viajes">
        <button type="button" role="tab" id="cnd-tab-proximos" aria-selected={pestana === 'proximos'} aria-controls="cnd-panel-viajes"
          className={`psj-tab${pestana === 'proximos' ? ' is-active' : ''}`} onClick={() => elegirPestana('proximos')}>Próximos</button>
        <button type="button" role="tab" id="cnd-tab-historial" aria-selected={pestana === 'historial'} aria-controls="cnd-panel-viajes"
          className={`psj-tab${pestana === 'historial' ? ' is-active' : ''}`} onClick={() => elegirPestana('historial')}>Historial</button>
      </div>

      <div id="cnd-panel-viajes" role="tabpanel" aria-labelledby={`cnd-tab-${pestana}`}>
        {sinAsignacion ? (
          <p className="psj-alert psj-alert--suave" role="status">{sinAsignacion}</p>
        ) : lista.length === 0 ? (
          <div className="psj-vacio">
            <p>{pestana === 'proximos' ? 'No tienes viajes asignados próximamente.' : 'Aún no tienes viajes en tu historial.'}</p>
          </div>
        ) : (
          <AnimatedContent as="ul" className="psj-lista" key={pestana} {...ENTRADA_TARJETAS}>
            {lista.map((v) => <TarjetaViaje key={v.id} viaje={v} capacidad={van!.asientos} desdeHistorial={pestana === 'historial'} />)}
          </AnimatedContent>
        )}
      </div>
    </div>
  )
}
