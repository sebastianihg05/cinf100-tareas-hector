import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Trayecto } from '../admin/types'
import { SEDES_ORIGEN, type DiaViajes, type Modalidad } from './viajes'

/** Reserva en curso: lo que el pasajero va eligiendo antes de confirmar. Vive solo en memoria. */
export type Borrador = {
  sede: string
  /** ISO yyyy-mm-dd; vacía mientras no se elige */
  fecha: string
  modalidad: Modalidad
  asientos: Partial<Record<Trayecto, number>>
  /** viajes de la fecha elegida, tal como llegaron de la API al pulsar "Seleccionar asientos" */
  viajes: DiaViajes
}

export const borradorInicial = (sede: string = SEDES_ORIGEN[0]): Borrador => ({
  sede,
  fecha: '',
  modalidad: 'IdaVuelta',
  asientos: {},
  viajes: {},
})

type Api = { borrador: Borrador; setBorrador: (b: Borrador) => void }

const BorradorContext = createContext<Api | null>(null)

export function BorradorProvider({ children }: { children: ReactNode }) {
  const [borrador, setBorrador] = useState<Borrador>(() => borradorInicial())
  const api = useMemo(() => ({ borrador, setBorrador }), [borrador])
  return <BorradorContext.Provider value={api}>{children}</BorradorContext.Provider>
}

export function useBorrador() {
  const ctx = useContext(BorradorContext)
  if (!ctx) throw new Error('useBorrador debe usarse dentro de <BorradorProvider>')
  return ctx
}
