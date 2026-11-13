import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCalendar, IconInfo } from '../components/icons'
import Field from '../components/Field'
import { useAdmin } from '../store/AdminContext'
import { DIAS_MAX_ANTICIPACION, DIAS_MIN_ANTICIPACION, HORA_TRAYECTO, type Trayecto } from '../types'
import { sumarDias, todayISO } from '../utils/format'

type Opcion = 'Ida' | 'Vuelta' | 'Ida y vuelta'
const OPCIONES: Opcion[] = ['Ida', 'Vuelta', 'Ida y vuelta']

const trayectosDe = (o: Opcion): Trayecto[] => (o === 'Ida y vuelta' ? ['Ida', 'Vuelta'] : [o])

/** Formulario para abrir un viaje en un día sin viaje fijo (los miércoles y jueves ya tienen). */
export default function AbrirViaje() {
  const { state, abrirViajes } = useAdmin()
  const navigate = useNavigate()
  const [fecha, setFecha] = useState('')
  const [opcion, setOpcion] = useState<Opcion>('Ida')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const volver = () => navigate('/admin/viajes')
  const desde = sumarDias(todayISO(), DIAS_MIN_ANTICIPACION)
  const hasta = sumarDias(todayISO(), DIAS_MAX_ANTICIPACION)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trayectos = trayectosDe(opcion)

    if (!fecha) return setError('Selecciona la fecha del viaje')
    if (fecha < desde || fecha > hasta) return setError('La fecha debe estar entre 1 y 30 días desde hoy')
    // los viajes cancelados no cuentan
    if (state.viajes.some((v) => v.estado !== 'cancelado' && v.fecha === fecha && trayectos.includes(v.trayecto))) {
      return setError('Ya hay un viaje abierto ese día para el trayecto elegido')
    }

    // se guarda en PostgreSQL; si el servidor rechaza el viaje, el motivo se muestra en el formulario
    setGuardando(true)
    const resultado = await abrirViajes(fecha, trayectos)
    setGuardando(false)
    if (!resultado.ok) return setError(resultado.error)
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
        <Field label="Fecha del viaje" error={error} hint="Entre 1 y 30 días desde hoy. Puedes abrir viajes cualquier día, incluidos miércoles y jueves.">
          {(p) => <input {...p} type="date" min={desde} max={hasta} value={fecha}
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

      <button type="submit" className="adm-btn adm-btn--primary adm-btn--block" disabled={guardando}>
        <IconCalendar size={18} /> {guardando ? 'Abriendo viaje…' : 'Abrir viaje'}
      </button>
    </form>
  )
}
