import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCalendar, IconInfo } from '../components/icons'
import Field from '../components/Field'
import { useAdmin } from '../store/AdminContext'
import { nuevoId } from '../store/adminStore'
import { HORA_TRAYECTO, RUTA_TRAYECTO, type Trayecto, type Viaje } from '../types'
import { todayISO } from '../utils/format'

type Opcion = 'Ida' | 'Vuelta' | 'Ida y vuelta'
const OPCIONES: Opcion[] = ['Ida', 'Vuelta', 'Ida y vuelta']

const trayectosDe = (o: Opcion): Trayecto[] => (o === 'Ida y vuelta' ? ['Ida', 'Vuelta'] : [o])

/** Formulario para abrir un viaje en un día sin viaje fijo (los miércoles y jueves ya tienen). */
export default function AbrirViaje() {
  const { state, addViajes } = useAdmin()
  const navigate = useNavigate()
  const [fecha, setFecha] = useState('')
  const [opcion, setOpcion] = useState<Opcion>('Ida')
  const [error, setError] = useState('')

  const volver = () => navigate('/admin/viajes')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trayectos = trayectosDe(opcion)

    if (!fecha) return setError('Selecciona la fecha del viaje')
    if (fecha < todayISO()) return setError('La fecha debe ser desde hoy en adelante')
    // el administrador puede abrir viajes cualquier día (también miércoles y jueves); los cancelados no cuentan
    if (state.viajes.some((v) => v.estado !== 'cancelado' && v.fecha === fecha && trayectos.includes(v.trayecto))) {
      return setError('Ya hay un viaje abierto ese día para el trayecto elegido')
    }

    const nuevos: Viaje[] = trayectos.map((t) => ({
      id: nuevoId('t'),
      ...RUTA_TRAYECTO[t],
      trayecto: t,
      fecha,
      hora: HORA_TRAYECTO[t],
      vanId: null,
      reservados: 0,
      estado: 'pendiente',
    }))
    addViajes(nuevos)
    volver()
  }

  return (
    <form className="adm-trip-form" onSubmit={submit} noValidate>
      <p className="adm-note adm-note--box" role="note">
        <IconInfo />
        <span>
          Los miércoles y jueves ya tienen viaje fijo con van dedicada. Abre un viaje cuando una actividad lo
          requiera otro día: quedará disponible para que cualquier funcionario reserve.
        </span>
      </p>

      <section className="adm-panel">
        <Field label="Fecha del viaje" error={error} hint="Desde hoy. Como administrador puedes abrir viajes cualquier día, incluidos miércoles y jueves.">
          {(p) => <input {...p} type="date" min={todayISO()} value={fecha}
            onChange={(e) => { setFecha(e.target.value); setError('') }} />}
        </Field>

        <div className="adm-field">
          <span className="adm-field__label" id="lbl-trayecto">Trayecto</span>
          <div className="adm-segmented" role="radiogroup" aria-labelledby="lbl-trayecto">
            {OPCIONES.map((o) => (
              <button key={o} type="button" role="radio" aria-checked={opcion === o}
                className={opcion === o ? 'is-active' : ''} onClick={() => setOpcion(o)}>{o}</button>
            ))}
          </div>
          <small className="adm-field__hint">
            Salidas: ida {HORA_TRAYECTO.Ida} hrs, vuelta {HORA_TRAYECTO.Vuelta} hrs. La administración asigna la van y el conductor.
          </small>
        </div>
      </section>

      <button type="submit" className="adm-btn adm-btn--primary adm-btn--block"><IconCalendar size={18} /> Abrir viaje</button>
    </form>
  )
}
