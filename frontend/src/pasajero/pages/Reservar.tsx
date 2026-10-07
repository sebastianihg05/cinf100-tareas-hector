import { useNavigate } from 'react-router-dom'
import { IconClock } from '../../admin/components/icons'
import { useAdmin } from '../../admin/store/AdminContext'
import { HORA_TRAYECTO } from '../../admin/types'
import { iniciales } from '../../admin/utils/format'
import { useBorrador } from '../borrador'
import {
  CARGO_PASAJERO, DESTINO, MODALIDADES, PASAJERO_ID, SEDES_ORIGEN,
  fechaTexto, fechasDisponibles, trayectosDe, useViajesSede, type Modalidad,
} from '../viajes'

export default function Reservar() {
  const { state } = useAdmin()
  const { borrador, setBorrador } = useBorrador()
  const navigate = useNavigate()
  const porFecha = useViajesSede(borrador.sede)
  const fechas = fechasDisponibles(porFecha, borrador.modalidad)
  const fecha = fechas.includes(borrador.fecha) ? borrador.fecha : (fechas[0] ?? '')

  const pasajero = state.pasajeros.find((p) => p.id === PASAJERO_ID)
  const puedeReservar = pasajero !== undefined && pasajero.aprobado && pasajero.habilitado

  const cambiarSede = (sede: string) => setBorrador({ ...borrador, sede, asientos: {} })
  const cambiarFecha = (f: string) => setBorrador({ ...borrador, fecha: f, asientos: {} })
  const cambiarModalidad = (modalidad: Modalidad) => {
    // Solo se conservan los asientos de los trayectos que siguen incluidos.
    const asientos = Object.fromEntries(trayectosDe(modalidad)
      .filter((t) => borrador.asientos[t] !== undefined).map((t) => [t, borrador.asientos[t]]))
    setBorrador({ ...borrador, modalidad, asientos })
  }

  const continuar = () => {
    if (!fecha || !puedeReservar) return
    setBorrador({ ...borrador, fecha, asientos: fecha === borrador.fecha ? borrador.asientos : {} })
    navigate(borrador.modalidad === 'Vuelta' ? '/pasajero/asiento/vuelta' : '/pasajero/asiento/ida')
  }

  return (
    <div className="psj-page psj-page--nav-accion">
      <section className="psj-user">
        <div className="psj-user__info">
          <div className="psj-avatar" aria-hidden="true">{iniciales(pasajero?.nombre ?? 'Constanza Silva')}</div>
          <div>
            <p className="psj-user__name">Hola, {(pasajero?.nombre ?? 'Constanza Silva').split(' ')[0]}</p>
            <p className="psj-user__sub">{CARGO_PASAJERO}</p>
          </div>
        </div>
        {puedeReservar && <span className="psj-badge psj-badge--activo">Activo</span>}
      </section>

      {!puedeReservar ? (
        <p className="psj-alert" role="alert">
          {pasajero
            ? 'Tu cuenta no está habilitada para reservar. Contacta a la administración de transporte.'
            : 'No encontramos tu cuenta de pasajero. Contacta a la administración de transporte.'}
        </p>
      ) : (
        <form className="psj-form" onSubmit={(e) => { e.preventDefault(); continuar() }}>
          <label className="psj-field">
            <span className="psj-label">Sede de Origen</span>
            <select className="psj-control" value={borrador.sede} onChange={(e) => cambiarSede(e.target.value)}>
              {SEDES_ORIGEN.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <div className="psj-field">
            <label className="psj-label" htmlFor="psj-destino">Sede de Destino</label>
            <input id="psj-destino" className="psj-control" value={DESTINO} readOnly aria-describedby="psj-destino-ayuda" />
            <p id="psj-destino-ayuda" className="psj-help">Destino fijo institucional predeterminado</p>
          </div>

          <label className="psj-field">
            <span className="psj-label">Fecha del Viaje</span>
            {fechas.length > 0 ? (
              <select className="psj-control" value={fecha} onChange={(e) => cambiarFecha(e.target.value)}>
                {fechas.map((f) => <option key={f} value={f}>{fechaTexto(f)}</option>)}
              </select>
            ) : (
              <select className="psj-control" disabled value=""><option value="">No hay viajes disponibles</option></select>
            )}
          </label>
          {fechas.length === 0 && (
            <p className="psj-alert psj-alert--suave" role="status">
              No hay viajes disponibles desde {borrador.sede} para {MODALIDADES.find((m) => m.valor === borrador.modalidad)!.etiqueta.toLowerCase()}.
            </p>
          )}

          <div className="psj-field">
            <span className="psj-label" id="psj-tipo">Tipo de Viaje</span>
            <div className="psj-segmented" role="group" aria-labelledby="psj-tipo">
              {MODALIDADES.map((m) => (
                <button key={m.valor} type="button" aria-pressed={borrador.modalidad === m.valor}
                  className={`psj-segmented__item${borrador.modalidad === m.valor ? ' is-active' : ''}`}
                  onClick={() => cambiarModalidad(m.valor)}>{m.etiqueta}</button>
              ))}
            </div>
          </div>

          <div className="psj-horarios">
            <p className="psj-horarios__title"><IconClock size={14} /> Horarios de Transporte Fijos</p>
            <p className="psj-horarios__text"><strong>Ida:</strong> {HORA_TRAYECTO.Ida} hrs | <strong>Vuelta:</strong> {HORA_TRAYECTO.Vuelta} hrs</p>
          </div>

          <div className="psj-footer psj-footer--sobre-nav">
            <button type="submit" className="psj-btn psj-btn--primary" disabled={!fecha}>Seleccionar asientos</button>
          </div>
        </form>
      )}
    </div>
  )
}
