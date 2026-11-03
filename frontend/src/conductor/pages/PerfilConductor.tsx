import PerfilUsuario from '../../admin/components/PerfilUsuario'
import { useAdmin } from '../../admin/store/AdminContext'
import { sedeLabel } from '../../admin/types'
import { fechaLarga } from '../../admin/utils/format'
import { useConductorActual } from '../useConductorActual'

/** Perfil del conductor que inició sesión: sus datos, su van y el cierre de sesión. */
export default function PerfilConductor() {
  const { patchPasajero } = useAdmin()
  const { cuenta, pasajeroId, chofer, van } = useConductorActual()

  if (!cuenta) return <p className="psj-alert" role="alert">No encontramos tu cuenta de conductor.</p>

  const filas = [
    { etiqueta: 'Sede', valor: cuenta.sede ? sedeLabel(cuenta.sede) : 'Sin sede' },
    { etiqueta: 'Van asignada', valor: van ? van.patente : 'Sin van asignada' },
    ...(chofer ? [{ etiqueta: 'Licencia vigente hasta', valor: fechaLarga(chofer.licenciaHasta) }] : []),
  ]

  return (
    <div className="psj-page">
      <PerfilUsuario
        nombre={cuenta.nombre}
        email={cuenta.email}
        etiquetas={['Conductor', 'Cuenta UNAB']}
        filas={filas}
        celular={cuenta.celular}
        ultimoIngreso={cuenta.ultimoIngreso}
        onGuardarCelular={(celular) => patchPasajero(pasajeroId, { celular })}
      />
    </div>
  )
}
