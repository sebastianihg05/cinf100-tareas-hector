import { useEffect, useState } from 'react'
import { api, type UsuarioBd } from '../api'
import { isoLocal, normalizarTelefono } from '../admin/utils/format'

/** Datos de la cuenta del funcionario que se muestran en el panel. */
export type MiCuenta = {
  nombre: string
  email: string
  sede: string
  /** +56 9 XXXX XXXX */
  celular: string
  /** ISO yyyy-mm-ddThh:mm */
  ultimoIngreso: string
  /** cuenta aprobada y no desactivada: puede reservar */
  habilitada: boolean
}

export const aMiCuenta = (u: UsuarioBd): MiCuenta => ({
  nombre: u.nombreCompleto,
  email: u.correo,
  sede: u.sede ?? '',
  celular: normalizarTelefono(u.telefono) ?? u.telefono,
  ultimoIngreso: isoLocal(u.ultimoIngresoEn ?? u.creadoEn),
  habilitada: u.estado === 'aprobada',
})

/**
 * S3-RES-04 (#2608): la cuenta del funcionario se lee de la base (GET /api/usuarios/me),
 * no de la copia que guardaba la app en el navegador.
 */
export function useMiCuenta() {
  const [cuenta, setCuenta] = useState<MiCuenta | undefined>(undefined)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    api.miPerfil().then((r) => {
      if (!vigente) return
      setCargando(false)
      if (r.ok) setCuenta(aMiCuenta(r.datos.usuario))
      else setError(r.error)
    })
    return () => { vigente = false }
  }, [])

  /** Después de guardar el celular, el backend devuelve la cuenta actualizada. */
  const actualizar = (u: UsuarioBd) => setCuenta(aMiCuenta(u))

  return { cuenta, cargando, error, actualizar }
}
