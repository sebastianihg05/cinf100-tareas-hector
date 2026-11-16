import { Link, useNavigate } from 'react-router-dom'
import { IconChevron, IconClock } from '../../admin/components/icons'
import { HORA_TRAYECTO, sedeLabel } from '../../admin/types'
import { iniciales } from '../../admin/utils/format'
import { usePasajeroActual } from '../../login/usePasajeroActual'
import { useBorrador } from '../borrador'
import {
  CARGO_PASAJERO, DESTINO, MODALIDADES, SEDES_ORIGEN,
  fechasDisponibles, trayectosDe, useViajesSede, ventanaReserva, type Modalidad,
} from '../viajes'
import StarBorder from '../../reactbits/StarBorder'
import { UNAB } from '../../reactbits/unab'

export default function Reservar() {
  const { borrador, setBorrador } = useBorrador()
  const navigate = useNavigate()
  const { porFecha, cargando, error } = useViajesSede(borrador.sede)
  const fechas = fechasDisponibles(porFecha, borrador.modalidad)
  const { desde, hasta } = ventanaReserva()
  const fecha = borrador.fecha || (fechas[0] ?? '')
  const fueraDeRango = fecha !== '' && (fecha < desde || fecha > hasta)
  const sinViajes = !cargando && !error && fecha !== '' && !fueraDeRango && !fechas.includes(fecha)

  const { pasajero } = usePasajeroActual()
  const puedeReservar = pasajero !== undefined && pasajero.aprobado && pasajero.habilitado

  const cambiarFecha = (f: string) => setBorrador({ ...borrador, fecha: f, asientos: {}, viajes: {} })
  const cambiarModalidad = (modalidad: Modalidad) => {
    // Solo se conservan los asientos de los trayectos que siguen incluidos.
    const asientos = Object.fromEntries(trayectosDe(modalidad)
      .filter((t) => borrador.asientos[t] !== undefined).map((t) => [t, borrador.asientos[t]]))
    setBorrador({ ...borrador, modalidad, asientos })
  }

  const continuar = () => {
    if (!fechas.includes(fecha) || !puedeReservar) return
    // Se guardan los viajes del día para que la selección de asiento sepa a qué viaje reservar.
    setBorrador({ ...borrador, fecha, asientos: fecha === borrador.fecha ? borrador.asientos : {}, viajes: porFecha.get(fecha) ?? {} })
    navigate(borrador.modalidad === 'Vuelta' ? '/pasajero/asiento/vuelta' : '/pasajero/asiento/ida')
  }

  return (
    <div className="psj-page psj-page--nav-accion">
      <Link to="/pasajero/perfil" className="psj-user psj-user--enlace" aria-label="Ir a mi perfil">
        <div className="psj-user__info">
          <div className="psj-avatar" aria-hidden="true">{iniciales(pasajero?.nombre ?? 'Funcionario')}</div>
          <div>
            <p className="psj-user__name">Hola, {(pasajero?.nombre ?? 'Funcionario').split(' ')[0]}</p>
            <p className="psj-user__sub">{CARGO_PASAJERO}</p>
          </div>
        </div>
        <span className="psj-user__fin">
          {puedeReservar && <span className="psj-badge psj-badge--activo">Activo</span>}
          <IconChevron size={18} />
        </span>
      </Link>

      {!puedeReservar ? (
        <p className="psj-alert" role="alert">
          {pasajero
            ? 'Tu cuenta no está habilitada para reservar. Contacta a la administración de transporte.'
            : 'No encontramos tu cuenta de pasajero. Contacta a la administración de transporte.'}
        </p>
      ) : (
        <form className="psj-form" onSubmit={(e) => { e.preventDefault(); continuar() }}>
          <div className="psj-field">
            <label className="psj-label" htmlFor="psj-origen">Sede de Origen</label>
            <input id="psj-origen" className="psj-control" value={sedeLabel(SEDES_ORIGEN[0])} readOnly aria-describedby="psj-origen-ayuda" />
            <p id="psj-origen-ayuda" className="psj-help">Origen fijo institucional predeterminado</p>
          </div>

          <div className="psj-field">
            <label className="psj-label" htmlFor="psj-destino">Sede de Destino</label>
            <input id="psj-destino" className="psj-control" value={DESTINO} readOnly aria-describedby="psj-destino-ayuda" />
            <p id="psj-destino-ayuda" className="psj-help">Destino fijo institucional predeterminado</p>
          </div>

          <label className="psj-field">
            <span className="psj-label">Fecha del Viaje</span>
            <input type="date" className="psj-control" value={fecha} min={desde} max={hasta}
              onChange={(e) => cambiarFecha(e.target.value)} />
            <p className="psj-help">Entre 1 y 30 días desde hoy</p>
          </label>
          {fueraDeRango && (
            <p className="psj-alert psj-alert--suave" role="alert">La fecha debe estar entre 1 y 30 días desde hoy.</p>
          )}
          {cargando && <p className="psj-help" role="status">Buscando viajes disponibles…</p>}
          {error && <p className="psj-alert" role="alert">{error}</p>}
          {(sinViajes || (!cargando && !error && fecha === '' && fechas.length === 0)) && (
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
            {/* RB-05: luz que recorre el borde del botón principal (React Bits StarBorder) */}
            <StarBorder type="submit" disabled={!fechas.includes(fecha)} color={UNAB.rojo} trailColor={UNAB.blanco}
              backgroundColor={UNAB.navy} textColor={UNAB.blanco} radius={10} style={{ width: '100%' }}>Seleccionar asientos</StarBorder>
          </div>
        </form>
      )}
    </div>
  )
}
