
import { useState } from 'react'
import { useAdmin } from '../store/AdminContext'

export default function ListaPasajerosViaje() {
    const { state } = useAdmin()
    const [viajeSeleccionado, setViajeSeleccionado] = useState('')

    const viajes = [...state.viajes].sort((a, b) =>
        `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`)
    )

    const viajeId = viajes.some((v) => v.id === viajeSeleccionado)
        ? viajeSeleccionado
        : (viajes[0]?.id ?? '')

    const viaje = viajes.find((v) => v.id === viajeId)

    const reservas = state.reservas
        .filter((r) => r.viajeId === viajeId)
        .sort((a, b) => a.asiento - b.asiento)

    const pasajerosPorId = new Map(
        state.pasajeros.map((p) => [p.id, p])
    )

    const reservasActivas = reservas.filter(
        (r) => r.estado !== 'cancelada'
    )

    const estiloTabla = {
        width: '100%',
        borderCollapse: 'collapse' as const,
        textAlign: 'left' as const,
    }

    const estiloCelda = {
        padding: '12px',
        borderBottom: '1px solid #e5e7eb',
    }

    return (
        <section
      style= {{
        background: '#fff',
            border: '1px solid #e5e7eb',
                borderRadius: '12px',
                    padding: '24px',
                        marginTop: '24px',
                            color: '#1f2937',
      }
}
    >
    <h2 style={ { marginTop: 0 } }>
        Pasajeros y asientos por viaje
            </h2>

            < label
htmlFor = "viaje-pasajeros"
style = {{ display: 'block', marginBottom: '8px' }}
      >
    Seleccionar viaje
        </label>

        < select
id = "viaje-pasajeros"
value = { viajeId }
onChange = {(e) => setViajeSeleccionado(e.target.value)}
style = {{
    width: '100%',
        maxWidth: '520px',
            padding: '10px',
                border: '1px solid #d1d5db',
                    borderRadius: '8px',
                        marginBottom: '20px',
        }}
      >
    {
        viajes.length === 0 && (
            <option value=""> No hay viajes registrados</ option >
        )}

{
    viajes.map((v) => (
        <option key= { v.id } value = { v.id } >
        { v.origen } → { v.destino } | { v.fecha } | { v.hora }
        </option>
    ))
}
</select>

{
    viaje && (
        <>
        <div
            style={
        {
            display: 'flex',
                flexWrap: 'wrap',
                    gap: '20px',
                        marginBottom: '20px',
            }
    }
          >
        <div>
        <strong>Ruta: </strong> {viaje.origen} → {viaje.destino}
            </div>

            < div >
            <strong>Fecha: </strong> {viaje.fecha}
                </div>

                < div >
                <strong>Hora: </strong> {viaje.hora}
                    </div>

                    < div >
                    <strong>Estado: </strong> {viaje.estado}
                        </div>

                        < div >
                        <strong>Pasajeros con reserva activa: </strong>{' '}
    { reservasActivas.length }
    </div>
        </div>

    {
        reservas.length === 0 ? (
            <p>Este viaje todavía no tiene reservas.</p>
          ) : (
            <div style= {{ overflowX: 'auto' }
    }>
        <table style={ estiloTabla }>
            <thead>
            <tr style={ { background: '#f9fafb' } }>
                <th style={ estiloCelda }> Asiento </th>
                    < th style = { estiloCelda } > Pasajero </th>
                        < th style = { estiloCelda } > Correo </th>
                            < th style = { estiloCelda } > Trayecto </th>
                                < th style = { estiloCelda } > Estado de reserva </th>
                                    </tr>
                                    </thead>

                                    <tbody>
    {
        reservas.map((reserva) => {
            const pasajero = pasajerosPorId.get(
                reserva.pasajeroId
            )

            return (
                <tr key= { reserva.id } >
                <td style={ estiloCelda }>
                { reserva.asiento }
                    </td>

                    < td style = { estiloCelda } >
                    { pasajero?.nombre ?? 'Pasajero no encontrado'
        }
                        </td>

            < td style = { estiloCelda } >
            { pasajero?.email ?? '—'}
    </td>

        < td style = { estiloCelda } >
        { reserva.trayecto }
            </td>

            < td style = { estiloCelda } >
            {
                reserva.estado === 'pendiente'
                    ? 'Pendiente'
                    : reserva.estado === 'completada'
                        ? 'Completada'
                        : 'Cancelada'
            }
                </td>
                </tr>
                    )
})}
</tbody>
    </table>
    </div>
          )}
</>
      )}
</section>
  )
}
