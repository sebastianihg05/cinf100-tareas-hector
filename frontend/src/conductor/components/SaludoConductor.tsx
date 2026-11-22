import { IconTruck } from '../../admin/components/icons'
import { iniciales } from '../../admin/utils/format'
import { useConductorActual } from '../useConductorActual'

/** Franja "Hola, ..." con la van del conductor. UI-04 (C3): la usan Mis viajes e Historial. */
export default function SaludoConductor() {
  const { nombre, van } = useConductorActual()
  return (
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
  )
}
