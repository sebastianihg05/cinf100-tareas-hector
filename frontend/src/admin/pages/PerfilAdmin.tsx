import { useGuardarCelular } from '../../login/useGuardarCelular'
import PerfilUsuario from '../components/PerfilUsuario'
import { useAdmin } from '../store/AdminContext'

/** Perfil del administrador. */
export default function PerfilAdmin() {
  const { state, updateAdmin } = useAdmin()
  const guardarCelular = useGuardarCelular()
  const { admin } = state

  return (
    <PerfilUsuario
      nombre={admin.nombre}
      email={admin.email}
      etiquetas={[admin.cargo, 'Cuenta UNAB']}
      celular={admin.celular}
      ultimoIngreso={admin.ultimoIngreso}
      onGuardarCelular={(celular) => guardarCelular(celular, () => updateAdmin({ celular }))}
    />
  )
}
