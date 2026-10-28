import type { GrupoReserva } from '../store/reservas'
import type { EstadoReserva, Pasajero } from '../types'
import { fechaLarga } from '../utils/format'

const ESTADOS: Record<EstadoReserva, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

type Props = {
  pasajero: Pasajero
  proximas: GrupoReserva[]
  historial: GrupoReserva[]
  onVolver: () => void
}

/** HU-16: consulta administrativa de todas las reservas, sin acciones de modificación. */
export default function DetalleReservasPasajero({ pasajero, proximas, historial, onVolver }: Props) {
  const total = proximas.length + historial.length

  const mostrarGrupos = (grupos: GrupoReserva[]) => (
    <ul className="adm-reservas__lista">
      {grupos.map((grupo) => (
        <li key={grupo.grupoId} className="adm-reservas__grupo">
          <div className="adm-reservas__grupo-cabecera">
            <strong>{grupo.fecha ? fechaLarga(grupo.fecha) : 'Fecha no disponible'}</strong>
            <span className={`adm-reservas__estado adm-reservas__estado--${grupo.estado}`}>
              {ESTADOS[grupo.estado]}
            </span>
          </div>
          <ul className="adm-reservas__trayectos">
            {grupo.trayectos.map(({ reserva, viaje }) => (
              <li key={reserva.id} className="adm-reservas__trayecto">
                <div className="adm-reservas__trayecto-cabecera">
                  <strong>{reserva.trayecto}</strong>
                  <span className={`adm-reservas__estado adm-reservas__estado--${reserva.estado}`}>
                    {ESTADOS[reserva.estado]}
                  </span>
                </div>
                <dl className="adm-reservas__datos">
                  <div><dt>Ruta</dt><dd>{viaje ? `${viaje.origen} → ${viaje.destino}` : 'Viaje no disponible'}</dd></div>
                  <div><dt>Hora de salida</dt><dd>{viaje ? `${viaje.hora} h` : 'No disponible'}</dd></div>
                  <div><dt>Asiento</dt><dd>{reserva.asiento}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )

  return (
    <section className="adm-reservas" aria-label={`Reservas de ${pasajero.nombre}`}>
      <button type="button" className="adm-reservas__volver" aria-label="Volver al perfil" onClick={onVolver}>
        ← Volver al perfil
      </button>
      <p className="adm-reservas__identidad">{pasajero.email}</p>
      <p className="adm-reservas__resumen">
        {total === 1 ? '1 reserva registrada' : `${total} reservas registradas`}
      </p>
      {total === 0 ? (
        <p className="adm-reservas__vacio">Este pasajero no tiene reservas registradas.</p>
      ) : (
        <>
          <section className="adm-reservas__seccion" aria-label="Reservas próximas">
            <h3>Próximas ({proximas.length})</h3>
            {proximas.length ? mostrarGrupos(proximas) : <p className="adm-reservas__vacio">No hay reservas próximas.</p>}
          </section>
          <section className="adm-reservas__seccion" aria-label="Historial de reservas">
            <h3>Historial ({historial.length})</h3>
            {historial.length ? mostrarGrupos(historial) : <p className="adm-reservas__vacio">No hay reservas en el historial.</p>}
          </section>
        </>
      )}
    </section>
  )
}
