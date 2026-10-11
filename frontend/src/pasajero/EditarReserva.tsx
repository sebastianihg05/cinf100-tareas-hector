import { useState } from 'react'
import Modal from '../admin/components/Modal'
import { useAdmin } from '../admin/store/AdminContext'
import { cancelables, type GrupoReserva } from '../admin/store/reservas'
import MapaAsientos from './MapaAsientos'

type Props = { grupo: GrupoReserva; pasajeroId: string; onClose: () => void; onGuardado: (mensaje: string) => void }

/** Cambia el asiento de cada trayecto pendiente de una reserva. */
export default function EditarReserva({ grupo, pasajeroId, onClose, onGuardado }: Props) {
  const { state, capacidadDe, asientosOcupadosDe, cambiarAsientos } = useAdmin()
  const editables = cancelables(state, pasajeroId, grupo.grupoId)
  const [elegidos, setElegidos] = useState<Record<string, number>>({})
  const [error, setError] = useState('')

  const guardar = () => {
    const cambios = editables
      .filter((r) => elegidos[r.id] !== undefined && elegidos[r.id] !== r.asiento)
      .map((r) => ({ id: r.id, asiento: elegidos[r.id] }))
    if (cambios.length === 0) return onClose()
    const res = cambiarAsientos(pasajeroId, grupo.grupoId, cambios)
    if (!res.ok) return setError(res.error)
    onGuardado('Tu reserva fue actualizada.')
  }

  return (
    <Modal title="Editar reserva" onClose={onClose}>
      {editables.map((r) => {
        const viaje = state.viajes.find((v) => v.id === r.viajeId)
        const capacidad = viaje ? capacidadDe(viaje) : undefined
        if (!viaje || capacidad === undefined) return null
        return (
          <section key={r.id} className="psj-editar__tramo">
            <h3 className="psj-editar__titulo">{r.trayecto} · {viaje.hora} hrs</h3>
            <MapaAsientos capacidad={capacidad} ocupados={asientosOcupadosDe(viaje.id).filter((n) => n !== r.asiento)}
              seleccionado={elegidos[r.id] ?? r.asiento}
              onSeleccionar={(n) => { setElegidos({ ...elegidos, [r.id]: n }); setError('') }} />
          </section>
        )
      })}
      {error && <p className="psj-alert" role="alert">{error}</p>}
      <div className="adm-form__actions">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="adm-btn adm-btn--primary" onClick={guardar}>Guardar cambios</button>
      </div>
    </Modal>
  )
}
