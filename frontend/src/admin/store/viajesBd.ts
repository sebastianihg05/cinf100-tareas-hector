import type { ViajeBd } from '../../api'
import type { Chofer, Pasajero, Reserva, Van, Viaje } from '../types'
import { isoLocal, normalizarTelefono } from '../utils/format'
import { numeroDeVan } from '../utils/vanBd'
import type { State } from './adminStore'
import { sincronizar } from './reservas'

/**
 * Qué parte de los viajes de la base trae una respuesta del backend:
 * - `todos`: la lista completa del administrador; lo que falta en ella ya no existe.
 * - `conductor`: solo los de ese conductor; se retiran los suyos que dejó de tener.
 * - `parcial`: uno o pocos viajes que acaban de cambiar; no se retira nada.
 */
export type AlcanceViajes = { tipo: 'todos' } | { tipo: 'conductor'; conductorId: number } | { tipo: 'parcial' }

/** id local de un viaje de la base. */
export const idLocalViaje = (idBd: number) => `vbd${idBd}`

/** Van local de un viaje de la base: la que tiene ese número o, si no, la del conductor asignado. */
function vanDe(vans: Van[], choferes: Chofer[], b: ViajeBd): string | null {
  if (b.vanId === null) return null
  const porNumero = vans.find((v) => numeroDeVan(v.id) === b.vanId)
  if (porNumero) return porNumero.id
  const chofer = choferes.find((c) => c.idBd !== undefined && c.idBd === b.conductorId)
  return vans.find((v) => chofer && v.choferId === chofer.id)?.id ?? null
}

/**
 * Copia en el estado los viajes que devolvió el backend, con sus reservas y pasajeros. La base manda:
 * un viaje de ejemplo del mismo día y trayecto se retira, y los cambios de estado que hizo otra persona
 * (por ejemplo, el conductor iniciando un viaje) se reflejan aquí, con su aviso al administrador.
 */
export function aplicarViajesBd(s: State, viajesBd: ViajeBd[], alcance: AlcanceViajes): State {
  const idsBd = new Set(viajesBd.map((b) => b.id))
  const activosBd = viajesBd.filter((b) => b.estado !== 'cancelado')

  // 1. viajes locales que se retiran: los que la base ya no tiene y los de ejemplo que ocupan el mismo lugar
  const retirar = (v: Viaje) => {
    if (v.idBd !== undefined) {
      if (idsBd.has(v.idBd)) return false
      if (alcance.tipo === 'todos') return true
      return alcance.tipo === 'conductor' && v.conductorIdBd === alcance.conductorId
    }
    return v.estado !== 'cancelado' && activosBd.some((b) => b.fecha === v.fecha && b.trayecto === v.trayecto)
  }
  const retirados = new Set(s.viajes.filter(retirar).map((v) => v.id))
  let viajes = s.viajes.filter((v) => !retirados.has(v.id))
  let reservas = s.reservas.filter((r) => !retirados.has(r.viajeId))
  let notificaciones = s.notificaciones.filter((n) => !retirados.has(n.viajeId))
  let pasajeros = s.pasajeros

  for (const b of viajesBd) {
    const anterior = viajes.find((v) => v.idBd === b.id)
    const id = anterior?.id ?? idLocalViaje(b.id)
    const nuevo: Viaje = {
      id, idBd: b.id, conductorIdBd: b.conductorId,
      trayecto: b.trayecto, origen: b.origen, destino: b.destino, fecha: b.fecha, hora: b.hora,
      vanId: vanDe(s.vans, s.choferes, b), estado: b.estado, reservados: anterior?.reservados ?? 0,
    }
    viajes = anterior ? viajes.map((v) => (v === anterior ? nuevo : v)) : [...viajes, nuevo]

    // el administrador se entera cuando otra persona inicia un viaje que ya conocía
    if (anterior?.estado === 'pendiente' && b.estado === 'en-curso' && !notificaciones.some((n) => n.viajeId === id)) {
      notificaciones = [{ id: `nbd${b.id}`, tipo: 'viaje-iniciado', viajeId: id, fecha: isoLocal(b.iniciadoEn ?? new Date().toISOString()), leida: false }, ...notificaciones]
    }

    // reservas de la base: reemplazan a las que ya se habían copiado; las hechas solo en este navegador se conservan
    reservas = reservas.filter((r) => !(r.viajeId === id && r.id.startsWith('rbd')))
    const delaBase: Reserva[] = []
    for (const r of b.reservas) {
      let pasajero = pasajeros.find((p) => p.idBd === r.usuarioId)
      if (!pasajero) {
        pasajero = pasajeroDeReserva(r.usuarioId, r.nombre, r.telefono)
        pasajeros = [...pasajeros, pasajero]
      }
      delaBase.push({
        id: `rbd${r.id}`, grupoId: `gbd${r.grupoId}`, pasajeroId: pasajero.id, viajeId: id, trayecto: b.trayecto,
        asiento: r.asiento, estado: r.estado, creadaEn: isoLocal(r.creadaEn),
      })
    }
    reservas = [...reservas, ...delaBase]
    if (b.estado === 'cancelado' || b.estado === 'completado') {
      const cierre = b.estado === 'cancelado' ? 'cancelada' : 'completada'
      reservas = reservas.map((r) => (r.viajeId === id && r.estado === 'pendiente' ? { ...r, estado: cierre } : r))
    }
  }

  return sincronizar({ ...s, viajes, reservas, notificaciones, pasajeros })
}

/** Pasajero mínimo para mostrar a quien reservó; se completa cuando el administrador carga las cuentas. */
function pasajeroDeReserva(usuarioId: number, nombre: string, telefono: string): Pasajero {
  return {
    id: `bd${usuarioId}`, idBd: usuarioId, nombre, email: '', sede: '', celular: normalizarTelefono(telefono) ?? telefono,
    ultimoIngreso: '', rol: 'funcionario', aprobado: true, puedeAbrirViajes: false, habilitado: true,
  }
}
