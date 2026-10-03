import { useId, type ReactNode } from 'react'

type ControlProps = { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }

type Props = {
  label: string
  error?: string
  hint?: string
  children: (control: ControlProps) => ReactNode
}

export default function Field({ label, error, hint, children }: Props) {
  const id = useId()
  const errId = `${id}-err`
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error ? errId : undefined })}
      {hint && !error && <small className="adm-field__hint">{hint}</small>}
      {error && <small id={errId} role="alert" className="adm-field__error">{error}</small>}
    </div>
  )
}
