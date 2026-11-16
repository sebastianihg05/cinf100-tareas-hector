// Pantalla de selección de asiento, compartida por Ida y Vuelta (cambia solo el trayecto).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, type AsientosBd } from '../api'
import type { Trayecto } from '../admin/types'
import { borradorInicial, useBorrador } from './borrador'
import MapaAsientos from './MapaAsientos'
import ClickSpark from '../reactbits/ClickSpark'
import { UNAB } from '../reactbits/unab'
import { fechaTexto, trayectosDe } from './viajes'

export default function SeleccionAsiento({ trayecto }: { trayecto: Trayecto }) {
  const { borrador, setBorrador } = useBorrador()
  const navigate = useNavigate()
  const viaje = borrador.viajes[trayecto]
  const [asientos, setAsientos] = useState<AsientosBd | null>(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [seleccion, setSeleccion] = useState<number | undefined>(borrador.asientos[trayecto])
  const [errores, setErrores] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const enviandoRef = useRef(false)
  const [hecho, setHecho] = useState(false)

  // S3-RES-04 (#2608): los asientos ocupados se leen de la base (GET /api/viajes/:id/asientos).
  const viajeId = viaje?.id
  const cargarAsientos = useCallback(async () => {
    if (viajeId === undefined) return
    const r = await api.asientosDeViaje(viajeId)
    if (r.ok) {
      setAsientos(r.datos)
      setErrorCarga('')
    } else {
      setErrorCarga(r.error)
    }
  }, [viajeId])

  useEffect(() => {
    void cargarAsientos()
  }, [cargarAsientos])

  // Tras reservar, el borrador se limpia: no redirigir a Reservar mientras se navega a la confirmación.
  if (hecho) return null
  const trayectos = trayectosDe(borrador.modalidad)
  if (!borrador.fecha || !trayectos.includes(trayecto)) return <Navigate to="/pasajero/reservar" replace />

  if (!viaje || errorCarga) {
    return (
      <div className="psj-page">
        <p className="psj-alert" role="alert">
          {errorCarga || `El viaje de ${trayecto} del ${fechaTexto(borrador.fecha)} ya no está disponible.`}
        </p>
        <Link to="/pasajero/reservar" className="psj-btn psj-btn--secondary">Volver a Reservar</Link>
      </div>
    )
  }

  const capacidad = asientos?.capacidad ?? 0
  const ocupados = asientos?.ocupados ?? []
  const elegido = seleccion !== undefined && seleccion <= capacidad && !ocupados.includes(seleccion) ? seleccion : undefined
  const esIdaDeIdaVuelta = borrador.modalidad === 'IdaVuelta' && trayecto === 'Ida'
  const faltaIda = borrador.modalidad === 'IdaVuelta' && trayecto === 'Vuelta' && borrador.asientos.Ida === undefined

  const confirmar = async () => {
    if (enviandoRef.current || elegido === undefined) return
    const elegidos = { ...borrador.asientos, [trayecto]: elegido }
    if (esIdaDeIdaVuelta) {
      setBorrador({ ...borrador, asientos: elegidos })
      navigate('/pasajero/asiento/vuelta')
      return
    }
    if (faltaIda) return
    const solicitudes = trayectos.flatMap((t) => {
      const v = borrador.viajes[t]
      const asiento = elegidos[t]
      return v && asiento !== undefined ? [{ viajeId: v.id, asiento }] : []
    })
    if (solicitudes.length !== trayectos.length) {
      setErrores(['Uno de los viajes ya no está disponible. Vuelve a Reservar para elegir otra fecha.'])
      return
    }

    // POST /api/reservas: con ida y vuelta se guardan las dos o ninguna.
    enviandoRef.current = true
    setEnviando(true)
    const r = await api.crearReservas(solicitudes)
    if (r.ok) {
      setHecho(true)
      setBorrador(borradorInicial(borrador.sede))
      navigate('/pasajero/confirmacion', { replace: true, state: { reserva: r.datos } })
      return
    }
    enviandoRef.current = false
    setEnviando(false)
    setErrores([r.error])
    // 409: alguien tomó el asiento o el viaje cambió; se vuelven a leer los ocupados.
    if (r.status === 409) {
      setBorrador({ ...borrador, asientos: elegidos })
      await cargarAsientos()
    }
  }

  return (
    <div className="psj-page psj-page--accion">
      <section className="psj-viaje">
        <div>
          <p className="psj-viaje__ruta">{viaje.origen} → {viaje.destino}</p>
          <p className="psj-viaje__fecha">{fechaTexto(viaje.fecha)}</p>
        </div>
        <span className="psj-chip">{viaje.hora} hrs</span>
      </section>

      {errores.length > 0 && (
        <div className="psj-alert" role="alert">
          {errores.map((e) => <p key={e}>{e}</p>)}
          {borrador.modalidad === 'IdaVuelta' && trayecto === 'Vuelta' && (
            <Link to="/pasajero/asiento/ida" className="psj-link">Elegir otro asiento de Ida</Link>
          )}
        </div>
      )}
      {faltaIda && errores.length === 0 && (
        <div className="psj-alert psj-alert--suave" role="status">
          <p>Primero elige tu asiento de Ida.</p>
          <Link to="/pasajero/asiento/ida" className="psj-link">Ir a la Ida</Link>
        </div>
      )}

      {asientos === null ? (
        <p className="psj-seleccion" role="status">Cargando asientos…</p>
      ) : (
        <MapaAsientos capacidad={capacidad} ocupados={ocupados} seleccionado={elegido}
          onSeleccionar={(n) => { setSeleccion(n); setErrores([]) }} />
      )}

      <p className="psj-seleccion" aria-live="polite">
        {elegido !== undefined ? `Asiento seleccionado: ${elegido}` : 'Selecciona un asiento disponible'}
      </p>

      <div className="psj-footer">
        {/* RB-05: chispas al confirmar el asiento (React Bits ClickSpark) */}
        <ClickSpark sparkColor={[UNAB.rojo, UNAB.navy]} sparkCount={12} sparkRadius={34} shape="star" style={{ height: 'auto' }}>
          <button type="button" className="psj-btn psj-btn--primary" onClick={() => void confirmar()}
            disabled={elegido === undefined || enviando || faltaIda}>
            {enviando ? 'Reservando…' : `Confirmar Asiento ${trayecto}`}
          </button>
        </ClickSpark>
      </div>
    </div>
  )
}
