import { useAdmin } from '../store/AdminContext'
import type { EstadoViaje } from '../types'
import { fechaDMY } from '../utils/format'

type ListaPasajerosViajeProps = {
    viajeId: string
}

const ETIQUETA_ESTADO: Record<EstadoViaje, string> = {
    pendiente: 'Pendiente',
    'en-curso': 'En curso',
    completado: 'Completado',
    cancelado: 'Cancelado',
}

const ETIQUETA_RESERVA = {
    pendiente: 'Pendiente',
    completada: 'Completada',
    cancelada: 'Cancelada',
} as const

export default function ListaPasajerosViaje({
    viajeId,
}: ListaPasajerosViajeProps) {
    const { state } = useAdmin()

    const viaje = state.viajes.find((v) => v.id === viajeId)

    if (!viaje) {
        return <p className="adm-empty" > No se encontró el viaje seleccionado.</p>
    }

    const reservas = state.reservas
        .filter((reserva) => reserva.viajeId === viaje.id)
        .sort((a, b) => a.asiento - b.asiento)

    const reservasActivas = reservas.filter(
        (reserva) => reserva.estado !== 'cancelada',
    )

    const pasajerosPorId = new Map(
        state.pasajeros.map((pasajero) => [pasajero.id, pasajero]),
    )

    return (
        <div className= "adm-passengers" >
        <div className="adm-passengers__summary" >
            <p>
            <strong>Ruta: </strong> {viaje.origen} → {viaje.destino}
                </p>
                < p >
                <strong>Fecha: </strong> {fechaDMY(viaje.fecha)}
                    </p>
                    < p >
                    <strong>Hora: </strong> {viaje.hora} hrs
                        </p>
                        < p >
                        <strong>Estado: </strong> {ETIQUETA_ESTADO[viaje.estado]}
                            </p>
                            < p >
                            <strong>Reservas activas: </strong> {reservasActivas.length}
                                </p>
                                </div>

    {
        reservas.length === 0 ? (
            <p className= "adm-empty" > Este viaje todavía no tiene reservas.</p>
      ) : (
            <div className= "adm-passengers__table-wrap" >
            <table className="adm-passengers__table" >
                <thead>
                <tr>
                <th scope="col" > Asiento </th>
                    < th scope = "col" > Pasajero </th>
                        < th scope = "col" > Correo </th>
                            < th scope = "col" > Trayecto </th>
                                < th scope = "col" > Estado de reserva </th>
                                    </tr>
                                    </thead>
                                    <tbody>
        {
            reservas.map((reserva) => {
                const pasajero = pasajerosPorId.get(reserva.pasajeroId)

                return (
                    <tr key= { reserva.id } >
                    <td>{ reserva.asiento } </td>
                    < td > { pasajero?.nombre ?? 'Pasajero no encontrado'
            }</td>
            < td > { pasajero?.email ?? '—'} </td>
                < td > { reserva.trayecto } </td>
                < td > { ETIQUETA_RESERVA[reserva.estado]} </td>
                </tr>
                )
    })
}
</tbody>
    </table>
    </div>
      )}
</div>
  )
}