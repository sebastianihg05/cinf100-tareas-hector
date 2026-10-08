import PerfilUsuario from '../../admin/components/PerfilUsuario'
import { useAdmin } from '../../admin/store/AdminContext'
import { sedeLabel } from '../../admin/types'
import { usePasajeroActual } from '../../login/usePasajeroActual'
import { CARGO_PASAJERO } from '../viajes'

/** Perfil del funcionario que inició sesión. */
export default function PerfilPasajero() {
  const { patchPasajero } = useAdmin()
  const { pasajero, pasajeroId } = usePasajeroActual()

  if (!pasajero) return <p className="psj-alert" role="alert">No encontramos tu cuenta de funcionario.</p>

  return (
    <div className="psj-page psj-page--nav">
      <PerfilUsuario
        nombre={pasajero.nombre}
        email={pasajero.email}
        etiquetas={[CARGO_PASAJERO, 'Cuenta UNAB']}
        filas={[{ etiqueta: 'Sede', valor: pasajero.sede ? sedeLabel(pasajero.sede) : 'Sin sede' }]}
        celular={pasajero.celular}
        ultimoIngreso={pasajero.ultimoIngreso}
        onGuardarCelular={(celular) => patchPasajero(pasajeroId, { celular })}
      />
    </div>
  )
}
