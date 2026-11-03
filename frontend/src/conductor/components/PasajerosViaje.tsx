import type { PasajeroDelViaje } from '../viajes'

/**
 * Pasajeros con reserva vigente en un viaje y su número de asiento (solo lectura).
 * Si no hay ninguno, lo indica con un mensaje claro en lugar de dejar la lista vacía.
 */
export default function PasajerosViaje({ pasajeros }: { pasajeros: PasajeroDelViaje[] }) {
  if (pasajeros.length === 0) {
    return <p className="psj-alert psj-alert--suave" role="status">Este viaje no tiene pasajeros con reserva vigente.</p>
  }
  return (
    <ul className="cnd-pasajeros" aria-label="Pasajeros y asientos">
      {pasajeros.map((p) => (
        <li key={p.reservaId} className="cnd-pasajero">
          <span className="cnd-pasajero__asiento" aria-label={`Asiento ${p.asiento}`}>{p.asiento}</span>
          <span className="cnd-pasajero__nombre">{p.nombre}</span>
        </li>
      ))}
    </ul>
  )
}
