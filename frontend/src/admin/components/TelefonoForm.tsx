import { useState, type FormEvent } from 'react'
import { normalizarTelefono } from '../utils/format'
import Field from './Field'

/** onSubmit puede devolver un mensaje de error (por ejemplo, si el backend rechazó el celular). */
type Props = { initial: string; onSubmit: (telefono: string) => void | Promise<string | void>; onCancel: () => void }

export default function TelefonoForm({ initial, onSubmit, onCancel }: Props) {
  const [telefono, setTelefono] = useState(initial)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const tel = normalizarTelefono(telefono)
    if (!tel) return setError('Celular inválido. Ej: +56 9 1234 5678')
    const fallo = await onSubmit(tel)
    if (typeof fallo === 'string') setError(fallo)
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
