import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../store/AdminContext'
import { fechaDMY, fechaHora } from '../utils/format'
import PanelAvisos, { type Aviso } from './PanelAvisos'

/** Avisos del administrador: pasajeros por aprobar y viajes que iniciaron los conductores. */
export default function NotificacionesPanel({ onClose }: { onClose: () => void }) {
  const { state, pendientes, sinLeer, marcarLeida, marcarTodasLeidas, choferDeVan } = useAdmin()
  const navigate = useNavigate()

  const ir = (to: string) => {
    navigate(to)
    onClose()
  }

  const avisos: Aviso[] = []

  if (pendientes > 0) {
    avisos.push({
      id: 'por-aprobar',
      titulo: pendientes === 1 ? '1 pasajero por aprobar' : `${pendientes} pasajeros por aprobar`,
      lineas: ['Revisa las cuentas nuevas que esperan aprobación.'],
      sinLeer: true,
      onSeleccionar: () => ir('/admin/pasajeros?filtro=por-aprobar'),
    })
  }

  for (const n of state.notificaciones) {
    const viaje = state.viajes.find((v) => v.id === n.viajeId)
    const van = state.vans.find((v) => v.id === viaje?.vanId)
    const chofer = van && choferDeVan(van)
    avisos.push({
      id: n.id,
      titulo: 'Viaje iniciado',
      lineas: [
        ...(viaje ? [`${viaje.origen} → ${viaje.destino} · ${fechaDMY(viaje.fecha)} · ${viaje.hora} hrs`] : []),
        `${[chofer?.nombre, van?.patente].filter(Boolean).join(' · ')}${chofer || van ? ' · ' : ''}${fechaHora(n.fecha)}`,
      ],
      sinLeer: !n.leida,
      onSeleccionar: () => { marcarLeida(n.id); ir('/admin/viajes') },
    })
  }

  return <PanelAvisos avisos={avisos} sinLeer={sinLeer} onMarcarLeidas={marcarTodasLeidas} onClose={onClose} />
}
