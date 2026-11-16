import { useState } from 'react'
import Modal from '../admin/components/Modal'
import { api } from '../api'
import MapaAsientos from './MapaAsientos'
import { editables, type GrupoMio } from './misReservas'

type Props = { grupo: GrupoMio; onClose: () => void; onGuardado: (mensaje: string) => void }

/** Cambia el asiento de cada trayecto pendiente de una reserva (PATCH /api/reservas/:grupoId/asientos). */
export default function EditarReserva({ grupo, onClose, onGuardado }: Props) {
  const tramos = editables(grupo)
  const [elegidos, setElegidos] = useState<Record<number, number>>({})
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    const cambios = tramos
      .filter((t) => elegidos[t.id] !== undefined && elegidos[t.id] !== t.asiento)
      .map((t) => ({ reservaId: t.id, asiento: elegidos[t.id] }))
    if (cambios.length === 0) return onClose()
    setGuardando(true)
    const r = await api.cambiarAsientos(grupo.grupoId, cambios)
    setGuardando(false)
    if (!r.ok) return setError(r.error)
    onGuardado('Tu reserva fue actualizada.')
  }

  return (
    <Modal title="Editar reserva" onClose={onClose}>
      {tramos.map((t) => (
        <section key={t.id} className="psj-editar__tramo">
          <h3 className="psj-editar__titulo">{t.trayecto} · {t.hora} hrs</h3>
          {/* ocupados ya viene sin el asiento propio, así se puede volver a él */}
          <MapaAsientos capacidad={t.capacidad} ocupados={t.ocupados}
            seleccionado={elegidos[t.id] ?? t.asiento}
            onSeleccionar={(n) => { setElegidos({ ...elegidos, [t.id]: n }); setError('') }} />
        </section>
      ))}
      {error && <p className="psj-alert" role="alert">{error}</p>}
      <div className="adm-form__actions">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="adm-btn adm-btn--primary" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  )
}
