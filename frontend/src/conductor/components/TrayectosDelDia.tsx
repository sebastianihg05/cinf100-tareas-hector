import { Link } from 'react-router-dom'
import { IconClock } from '../../admin/components/icons'
import type { Viaje } from '../../admin/types'
import { ESTADO_VIAJE } from '../etiquetas'

type Props = {
  /** trayectos de la van ese día, ordenados por hora (incluye el viaje que se está viendo) */
  trayectos: Viaje[]
  /** id del viaje que se está viendo */
  actualId: string
  /** pasajeros con reserva vigente por viaje */
  pasajerosPorViaje: Record<string, number>
}

/** Los trayectos del día del conductor (ida y vuelta). Cada uno, salvo el actual, lleva a su detalle. */
export default function TrayectosDelDia({ trayectos, actualId, pasajerosPorViaje }: Props) {
  if (trayectos.length <= 1) {
    return <p className="psj-alert psj-alert--suave" role="status">Este es el único trayecto que tienes asignado ese día.</p>
  }
  return (
    <ul className="cnd-trayectos" aria-label="Trayectos del día">
      {trayectos.map((t) => {
        const estado = ESTADO_VIAJE[t.estado]
        const n = pasajerosPorViaje[t.id] ?? 0
        const contenido = (
          <>
            <span className={`psj-pill psj-pill--${t.trayecto === 'Ida' ? 'ida' : 'vuelta'}`}>{t.trayecto}</span>
            <span className="cnd-trayecto__info">
              <span><IconClock size={12} /> {t.hora} hrs · {n === 1 ? '1 pasajero' : `${n} pasajeros`}</span>
              <span className={`psj-badge ${estado.clase}`}>{estado.texto}</span>
            </span>
          </>
        )
        return (
          <li key={t.id}>
            {t.id === actualId
              ? <div className="cnd-trayecto is-actual" aria-current="true">{contenido}<small>Este viaje</small></div>
              : <Link className="cnd-trayecto" to={`/conductor/viajes/${t.id}`} aria-label={`Ver el trayecto de ${t.trayecto} de las ${t.hora}`}>{contenido}</Link>}
          </li>
        )
      })}
    </ul>
  )
}
