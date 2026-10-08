import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cerrarSesion } from '../../login/sesion'
import { fechaHora, iniciales } from '../utils/format'
import { IconEdit, IconLogout } from './icons'
import Modal from './Modal'
import TelefonoForm from './TelefonoForm'

type Props = {
  nombre: string
  email: string
  /** insignias bajo el correo (cargo, tipo de cuenta...) */
  etiquetas: string[]
  /** datos extra que se muestran antes del celular (ej. la sede) */
  filas?: { etiqueta: string; valor: string }[]
  celular: string
  /** ISO yyyy-mm-ddThh:mm */
  ultimoIngreso: string
  onGuardarCelular: (celular: string) => void
}

/**
 * Perfil de una persona con sesión iniciada: datos de contacto (el celular se puede editar) y cierre de sesión.
 * Lo usan el administrador y el funcionario. Solo tema claro: no hay selector de apariencia.
 */
export default function PerfilUsuario({ nombre, email, etiquetas, filas = [], celular, ultimoIngreso, onGuardarCelular }: Props) {
  const navigate = useNavigate()
  const [editando, setEditando] = useState(false)

  return (
    <div className="prf">
      <section className="prf__hero">
        <div className="prf__avatar">{iniciales(nombre)}</div>
        <h2>{nombre}</h2>
        <p className="prf__email">{email}</p>
        <div className="prf__badges">
          {etiquetas.map((e) => <span key={e}>{e}</span>)}
        </div>
      </section>

      <section className="prf__card" aria-labelledby="prf-contacto">
        <div className="prf__card-head">
          <h3 id="prf-contacto">Datos de contacto</h3>
          <button className="prf__edit" onClick={() => setEditando(true)}><IconEdit /> Editar</button>
        </div>
        {filas.map((f) => (
          <div key={f.etiqueta} className="prf__row"><span>{f.etiqueta}</span><strong>{f.valor}</strong></div>
        ))}
        <div className="prf__row"><span>Celular</span><strong>{celular}</strong></div>
        <div className="prf__row"><span>Último ingreso</span><strong>{fechaHora(ultimoIngreso)}</strong></div>
      </section>

      <button className="prf__logout" onClick={() => { cerrarSesion(); navigate('/login', { replace: true }) }}>
        <IconLogout /> Cerrar sesión
      </button>

      <p className="prf__foot">UNAB Transporte · Universidad Andrés Bello</p>

      {editando && (
        <Modal title="Editar datos de contacto" onClose={() => setEditando(false)}>
          <TelefonoForm initial={celular} onCancel={() => setEditando(false)}
            onSubmit={(nuevo) => { onGuardarCelular(nuevo); setEditando(false) }} />
        </Modal>
      )}
    </div>
  )
}
