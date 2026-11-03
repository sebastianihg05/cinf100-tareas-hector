import { useMemo } from 'react'
import { useAdmin } from '../admin/store/AdminContext'
import { leerSesion } from '../login/sesion'
import { asignacionDe, separarViajes, viajesFinalizados } from './viajes'

/** Datos del conductor que inició sesión: su cuenta, su van y sus viajes asignados. */
export function useConductorActual() {
  const { state } = useAdmin()
  const sesion = leerSesion()
  const pasajeroId = sesion?.pasajeroId ?? ''
  const correo = sesion?.correo ?? ''
  const { choferes, vans, viajes } = state

  const asignacion = useMemo(() => asignacionDe({ choferes, vans, viajes }, correo), [choferes, vans, viajes, correo])
  const { proximos, historial } = useMemo(() => separarViajes(asignacion.viajes), [asignacion.viajes])
  const finalizados = useMemo(() => viajesFinalizados(asignacion.viajes), [asignacion.viajes])

  return {
    nombre: sesion?.nombre ?? '',
    correo,
    pasajeroId,
    /** la cuenta del conductor tal como la guarda la app (celular, último ingreso...) */
    cuenta: state.pasajeros.find((p) => p.id === pasajeroId),
    asignacion,
    ...asignacion,
    proximos,
    historial,
    /** solo los viajes en estado Completado, el más reciente primero */
    finalizados,
  }
}

/** Mensaje que explica por qué no hay viajes cuando el conductor no tiene van; vacío si la tiene. */
export function motivoSinViajes({ chofer, van }: { chofer?: unknown; van?: unknown }): string {
  if (van) return ''
  return chofer
    ? 'Todavía no tienes una van asignada. La administración te la asignará y tus viajes aparecerán aquí.'
    : 'Tu correo no está registrado como chofer. Pide a la administración que te registre para ver tus viajes.'
}
