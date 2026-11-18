import { useState } from 'react'

type Props = {
  id: string
  etiqueta: string
  valor: string
  onCambiar: (valor: string) => void
  placeholder: string
  /** current-password al iniciar sesión, new-password al registrarse (así el gestor de contraseñas sabe qué hacer) */
  autoComplete: 'current-password' | 'new-password'
  /** texto de ayuda que queda visible bajo el campo */
  ayuda?: string
}

/**
 * Campo de contraseña con el botón Ver / Ocultar (VIS-03).
 * El botón dice qué campo muestra ("Ver contraseña") y tiene 44 px de alto para tocarlo en el celular.
 */
export default function CampoContrasena({ id, etiqueta, valor, onCambiar, placeholder, autoComplete, ayuda }: Props) {
  const [visible, setVisible] = useState(false)
  const idAyuda = ayuda ? `${id}-ayuda` : undefined
  const campo = etiqueta.toLowerCase()

  return (
    <div className="form-group">
      <label htmlFor={id}>{etiqueta}</label>

      <div className="password-field">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          autoComplete={autoComplete}
          aria-required="true"
          aria-describedby={idAyuda}
        />

        <button
          type="button"
          className="password-toggle"
          aria-controls={id}
          aria-label={visible ? `Ocultar ${campo}` : `Ver ${campo}`}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Ocultar' : 'Ver'}
        </button>
      </div>

      {ayuda && <p id={idAyuda} className="field-help">{ayuda}</p>}
    </div>
  )
}
