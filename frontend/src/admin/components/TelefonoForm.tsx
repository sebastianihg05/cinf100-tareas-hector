import { useState, type FormEvent } from 'react'
import { normalizarTelefono } from '../utils/format'
import Field from './Field'

type Props = { initial: string; onSubmit: (telefono: string) => void; onCancel: () => void }

export default function TelefonoForm({ initial, onSubmit, onCancel }: Props) {
  const [telefono, setTelefono] = useState(initial)
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const tel = normalizarTelefono(telefono)
    if (!tel) return setError('Celular inválido. Ej: +56 9 1234 5678')
    onSubmit(tel)
  }

  return (
    <form className="adm-form" onSubmit={submit} noValidate>
      <Field label="Celular" error={error}>
        {(p) => <input {...p} type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />}
      </Field>
      <div className="adm-form__actions">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="adm-btn adm-btn--primary">Guardar</button>
      </div>
    </form>
  )
}
