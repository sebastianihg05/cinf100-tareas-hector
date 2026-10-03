import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconEdit, IconLogout } from '../components/icons'
import Modal from '../components/Modal'
import TelefonoForm from '../components/TelefonoForm'
import { useAdmin } from '../store/AdminContext'
import { fechaHora, iniciales } from '../utils/format'

/** Perfil del administrador. Solo tema claro: no hay selector de apariencia. */
export default function PerfilAdmin() {
  const { state, updateAdmin } = useAdmin()
  const navigate = useNavigate()
  const [editando, setEditando] = useState(false)
  const { admin } = state

  return (
    <div className="prf">
      <section className="prf__hero">
        <div className="prf__avatar">{iniciales(admin.nombre)}</div>
        <h2>{admin.nombre}</h2>
        <p className="prf__email">{admin.email}</p>
        <div className="prf__badges">
          <span>{admin.cargo}</span>
          <span>Cuenta UNAB</span>
        </div>
      </section>

      <section className="prf__card" aria-labelledby="prf-contacto">
        <div className="prf__card-head">
          <h3 id="prf-contacto">Datos de contacto</h3>
          <button className="prf__edit" onClick={() => setEditando(true)}><IconEdit /> Editar</button>
        </div>
        <div className="prf__row"><span>Celular</span><strong>{admin.celular}</strong></div>
        <div className="prf__row"><span>Último ingreso</span><strong>{fechaHora(admin.ultimoIngreso)}</strong></div>
      </section>

      <button className="prf__logout" onClick={() => navigate('/login', { replace: true })}>
        <IconLogout /> Cerrar sesión
      </button>

      <p className="prf__foot">UNAB Transporte · Universidad Andrés Bello</p>

      {editando && (
        <Modal title="Editar datos de contacto" onClose={() => setEditando(false)}>
          <TelefonoForm initial={admin.celular} onCancel={() => setEditando(false)}
            onSubmit={(celular) => { updateAdmin({ celular }); setEditando(false) }} />
        </Modal>
      )}
    </div>
  )
}
