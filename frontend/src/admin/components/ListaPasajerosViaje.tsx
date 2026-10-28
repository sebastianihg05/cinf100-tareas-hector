import { useAdmin } from '../store/AdminContext'
import { estaActiva } from '../store/reservas'
import type { Viaje } from '../types'
import { fechaDMY } from '../utils/format'
import { ESTADOS_RESERVA } from './DetalleReservasPasajero'

/** HU-19: pasajeros de un viaje con su asiento (solo lectura). */
export default function ListaPasajerosViaje({ viaje }: { viaje: Viaje }) {
  const { state } = useAdmin()
  const reservas = state.reservas
    .filter((r) => r.viajeId === viaje.id)
    .sort((a, b) => a.asiento - b.asiento)
  const activas = reservas.filter(estaActiva).length

  return (
    <section className="adm-reservas" aria-label={`Pasajeros del viaje ${viaje.origen} → ${viaje.destino}`}>
      <p className="adm-reservas__identidad">
        {viaje.origen} → {viaje.destino} · {fechaDMY(viaje.fecha)} · {viaje.hora} hrs · {viaje.trayecto}
      </p>
      <p className="adm-reservas__resumen">
        {activas === 1 ? '1 pasajero con reserva activa' : `${activas} pasajeros con reserva activa`}
      </p>

      {reservas.length === 0 ? (
        <p className="adm-reservas__vacio">Este viaje todavía no tiene reservas.</p>
      ) : (
        <ul className="adm-reservas__trayectos" aria-label="Pasajeros y asientos">
          {reservas.map((r) => {
            const pasajero = state.pasajeros.find((p) => p.id === r.pasajeroId)
            return (
              <li key={r.id} className="adm-reservas__trayecto">
                <div className="adm-reservas__trayecto-cabecera">
                  <strong>Asiento {r.asiento}</strong>
                  <span className={`adm-reservas__estado adm-reservas__estado--${r.estado}`}>{ESTADOS_RESERVA[r.estado]}</span>
                </div>
                <dl className="adm-reservas__datos">
                  <div><dt>Pasajero</dt><dd>{pasajero?.nombre ?? 'Pasajero no encontrado'}</dd></div>
                  <div><dt>Correo</dt><dd>{pasajero?.email ?? '—'}</dd></div>
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
