import PerfilUsuario from '../../admin/components/PerfilUsuario'
import { sedeLabel } from '../../admin/types'
import { api } from '../../api'
import { useMiCuenta } from '../useMiCuenta'
import { CARGO_PASAJERO } from '../viajes'

/** Perfil del funcionario que inició sesión. Lee y guarda en la base (GET y PATCH /api/usuarios/me). */
export default function PerfilPasajero() {
  const { cuenta, cargando, error, actualizar } = useMiCuenta()

  if (cargando) return <p className="psj-vacio" role="status">Cargando tu perfil…</p>
  if (!cuenta) return <p className="psj-alert" role="alert">{error || 'No encontramos tu cuenta de funcionario.'}</p>

  // Si el backend rechaza el celular, se devuelve su mensaje y la ventana sigue abierta.
  const guardarCelular = async (celular: string) => {
    const r = await api.actualizarMiCelular(celular)
    if (!r.ok) return r.error
    actualizar(r.datos.usuario)
  }

  return (
    <div className="psj-page psj-page--nav">
      <PerfilUsuario
        nombre={cuenta.nombre}
        email={cuenta.email}
        etiquetas={[CARGO_PASAJERO, 'Cuenta UNAB']}
        filas={[{ etiqueta: 'Sede', valor: cuenta.sede ? sedeLabel(cuenta.sede) : 'Sin sede' }]}
        celular={cuenta.celular}
        ultimoIngreso={cuenta.ultimoIngreso}
        onGuardarCelular={guardarCelular}
      />
    </div>
  )
}
