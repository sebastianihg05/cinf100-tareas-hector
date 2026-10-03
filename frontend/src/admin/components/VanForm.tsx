import { useState, type FormEvent } from 'react'
import { useAdmin } from '../store/AdminContext'
import { nuevoId } from '../store/adminStore'
import type { Van } from '../types'
import { normalizarPatente } from '../utils/format'
import Field from './Field'

type Props = { initial?: Van; onSubmit: (van: Van) => void; onCancel: () => void }
type Errors = Partial<Record<'patente' | 'asientos', string>>

export default function VanForm({ initial, onSubmit, onCancel }: Props) {
  const { state, vanDeChofer } = useAdmin()
  const [patente, setPatente] = useState(initial?.patente ?? '')
  const [asientos, setAsientos] = useState(String(initial?.asientos ?? 8))
  const [choferId, setChoferId] = useState(initial?.choferId ?? '')
  const [errors, setErrors] = useState<Errors>({})

  const choferesDisponibles = state.choferes.filter((c) => c.activo)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    const pat = normalizarPatente(patente)
    if (!pat) errs.patente = 'Formato inválido. Ejemplos: FG-1251 o BBCD-12'
    else if (state.vans.some((v) => v.patente === pat && v.id !== initial?.id)) errs.patente = 'Ya existe una van con esa patente'

    const n = Number(asientos)
    if (!Number.isInteger(n) || n < 1 || n > 20) errs.asientos = 'Ingresa un número entre 1 y 20'

    setErrors(errs)
    if (errs.patente || errs.asientos || !pat) return

    onSubmit({
      id: initial?.id ?? nuevoId('v'),
      patente: pat,
      asientos: n,
      choferId: choferId || null,
      activa: initial?.activa ?? true,
    })
  }

  return (
    <form className="adm-form" onSubmit={submit} noValidate>
      <Field label="Patente" error={errors.patente} hint="Ej: FG-1251">
        {(p) => <input {...p} value={patente} onChange={(e) => setPatente(e.target.value)} autoComplete="off" />}
      </Field>

      <Field label="Cantidad de asientos" error={errors.asientos}>
        {(p) => <input {...p} type="number" min={1} max={20} value={asientos} onChange={(e) => setAsientos(e.target.value)} />}
      </Field>

      <Field label="Conductor asignado" hint="Un conductor maneja una sola van">
        {(p) => (
          <select {...p} value={choferId} onChange={(e) => setChoferId(e.target.value)}>
            <option value="">Sin asignar</option>
            {choferesDisponibles.map((c) => {
              const actual = vanDeChofer(c)
              const ocupado = actual && actual.id !== initial?.id
              return <option key={c.id} value={c.id}>{c.nombre}{ocupado ? ` (hoy en ${actual.patente})` : ''}</option>
            })}
          </select>
        )}
      </Field>

      <div className="adm-form__actions">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="adm-btn adm-btn--primary">{initial ? 'Guardar cambios' : 'Agregar van'}</button>
      </div>
    </form>
  )
}
