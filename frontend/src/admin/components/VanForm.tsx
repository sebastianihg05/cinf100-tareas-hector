import { useState, type FormEvent } from 'react'
import { useAdmin } from '../store/AdminContext'
import { nuevoId } from '../store/adminStore'
import { CAPACIDAD_VAN, type Van } from '../types'
import { normalizarPatente } from '../utils/format'
import Field from './Field'

type Props = {
  initial?: Van
  onSubmit: (van: Van) => Promise<void>
  onCancel: () => void
  guardando?: boolean
}

type Errors = Partial<Record<'patente', string>>

export default function VanForm({
  initial,
  onSubmit,
  onCancel,
  guardando = false,
}: Props) {
  const { state, vanDeChofer } = useAdmin()

  const [patente, setPatente] = useState(initial?.patente ?? '')
  const [choferId, setChoferId] = useState(initial?.choferId ?? '')
  const [errors, setErrors] = useState<Errors>({})

  const choferesDisponibles = state.choferes.filter((c) => c.activo)

  const submit = async (e: FormEvent) => {
    e.preventDefault()

    if (guardando) return

    const errs: Errors = {}
    const pat = normalizarPatente(patente)

    if (!pat) {
      errs.patente = 'Formato inválido. Ejemplos: FG-1251 o BBCD-12'
    } else if (state.vans.some((v) => v.patente === pat && v.id !== initial?.id)) {
      errs.patente = 'Ya existe una van con esa patente'
    }

    setErrors(errs)

    if (errs.patente || !pat) return

    await onSubmit({
      id: initial?.id ?? nuevoId('v'),
      patente: pat,
      asientos: CAPACIDAD_VAN,
      choferId: choferId || null,
      activa: initial?.activa ?? true,
    })
  }

  return (
    <form className="adm-form" onSubmit={submit} noValidate>
      <Field label="Patente" error={errors.patente} hint="Ej: FG-1251">
        {(p) => (
          <input
            {...p}
            value={patente}
            onChange={(e) => setPatente(e.target.value)}
            autoComplete="off"
            disabled={guardando}
          />
        )}
      </Field>

      <Field label="Cantidad de asientos" hint="Capacidad fija de la van">
        {(p) => (
          <input
            {...p}
            type="number"
            value={CAPACIDAD_VAN}
            readOnly
          />
        )}
      </Field>

      <Field label="Conductor asignado" hint="Un conductor maneja una sola van">
        {(p) => (
          <select
            {...p}
            value={choferId}
            onChange={(e) => setChoferId(e.target.value)}
            disabled={guardando}
          >
            <option value="">Sin asignar</option>

            {choferesDisponibles.map((c) => {
              const actual = vanDeChofer(c)
              const ocupado = actual && actual.id !== initial?.id

              return (
                <option key={c.id} value={c.id}>
                  {c.nombre}{ocupado ? ` (hoy en ${actual.patente})` : ''}
                </option>
              )
            })}
          </select>
        )}
      </Field>

      <div className="adm-form__actions">
        <button
          type="button"
          className="adm-btn adm-btn--ghost"
          onClick={onCancel}
          disabled={guardando}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="adm-btn adm-btn--primary"
          disabled={guardando}
        >
          {guardando
            ? 'Guardando...'
            : initial
              ? 'Guardar cambios'
              : 'Agregar van'}
        </button>
      </div>
    </form>
  )
}