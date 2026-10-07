// Pantalla de selección de asiento, compartida por Ida y Vuelta (cambia solo el trayecto).
import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAdmin } from '../admin/store/AdminContext'
import type { Trayecto } from '../admin/types'
import { borradorInicial, useBorrador } from './borrador'
import MapaAsientos from './MapaAsientos'
import { PASAJERO_ID, fechaTexto, trayectosDe, useViajesSede } from './viajes'

export default function SeleccionAsiento({ trayecto }: { trayecto: Trayecto }) {
  const { crearReservas, capacidadDe, asientosOcupadosDe } = useAdmin()
  const { borrador, setBorrador } = useBorrador()
  const navigate = useNavigate()
  const dia = useViajesSede(borrador.sede).get(borrador.fecha)
  const [seleccion, setSeleccion] = useState<number | undefined>(borrador.asientos[trayecto])
  const [errores, setErrores] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const enviandoRef = useRef(false)
  const [hecho, setHecho] = useState(false)

  // Tras reservar, el borrador se limpia: no redirigir a Reservar mientras se navega a la confirmación.
  if (hecho) return null
  const trayectos = trayectosDe(borrador.modalidad)
  if (!borrador.fecha || !trayectos.includes(trayecto)) return <Navigate to="/pasajero/reservar" replace />

  const viaje = dia?.[trayecto]
  if (!viaje) {
    return (
      <div className="psj-page">
        <p className="psj-alert" role="alert">El viaje de {trayecto} del {fechaTexto(borrador.fecha)} ya no está disponible.</p>
        <Link to="/pasajero/reservar" className="psj-btn psj-btn--secondary">Volver a Reservar</Link>
      </div>
    )
  }

  const capacidad = capacidadDe(viaje) ?? 0
  const ocupados = asientosOcupadosDe(viaje.id)
  const elegido = seleccion !== undefined && seleccion <= capacidad && !ocupados.includes(seleccion) ? seleccion : undefined
  const esIdaDeIdaVuelta = borrador.modalidad === 'IdaVuelta' && trayecto === 'Ida'
  const faltaIda = borrador.modalidad === 'IdaVuelta' && trayecto === 'Vuelta' && borrador.asientos.Ida === undefined

  const confirmar = () => {
    if (enviandoRef.current || elegido === undefined || !dia) return
    const asientos = { ...borrador.asientos, [trayecto]: elegido }
    if (esIdaDeIdaVuelta) {
      setBorrador({ ...borrador, asientos })
      navigate('/pasajero/asiento/vuelta')
      return
    }
    if (faltaIda) return
    const solicitud = trayectos.flatMap((t) => {
      const v = dia[t]
      const asiento = asientos[t]
      return v && asiento !== undefined ? [{ viajeId: v.id, trayecto: t, asiento }] : []
    })
    if (solicitud.length !== trayectos.length) {
      setErrores(['Uno de los viajes ya no está disponible. Vuelve a Reservar para elegir otra fecha.'])
      return
    }

    enviandoRef.current = true
    setEnviando(true)
    const resultado = crearReservas(PASAJERO_ID, solicitud)
    if (resultado.ok) {
      setHecho(true)
      setBorrador(borradorInicial(borrador.sede))
      navigate('/pasajero/confirmacion', { replace: true, state: { grupoId: resultado.grupoId } })
      return
    }
    enviandoRef.current = false
    setEnviando(false)
    if (resultado.tipo === 'almacenamiento') {
      setErrores([resultado.error])
      return
    }
    setErrores([...new Set(resultado.conflictos.map((c) => c.mensaje))].concat(resultado.conflictos.length ? [] : [resultado.error]))
    // Se descartan solo los asientos que dejaron de ser válidos; el resto de la selección se conserva.
    const invalidos = new Set(resultado.conflictos
      .filter((c) => c.codigo === 'asiento-ocupado' || c.codigo === 'asiento-invalido').map((c) => c.trayecto))
    const restantes = { ...asientos }
    for (const t of invalidos) if (t) delete restantes[t]
    setBorrador({ ...borrador, asientos: restantes })
    if (invalidos.has(trayecto)) setSeleccion(undefined)
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
          {faltaIda && <Link to="/pasajero/asiento/ida" className="psj-link">Elegir otro asiento de Ida</Link>}
        </div>
      )}
      {faltaIda && errores.length === 0 && (
        <div className="psj-alert psj-alert--suave" role="status">
          <p>Primero elige tu asiento de Ida.</p>
          <Link to="/pasajero/asiento/ida" className="psj-link">Ir a la Ida</Link>
        </div>
      )}

      <MapaAsientos capacidad={capacidad} ocupados={ocupados} seleccionado={elegido}
        onSeleccionar={(n) => { setSeleccion(n); setErrores([]) }} />

      <p className="psj-seleccion" aria-live="polite">
        {elegido !== undefined ? `Asiento seleccionado: ${elegido}` : 'Selecciona un asiento disponible'}
      </p>

      <div className="psj-footer">
        <button type="button" className="psj-btn psj-btn--primary" onClick={confirmar}
          disabled={elegido === undefined || enviando || faltaIda}>
          {enviando ? 'Reservando…' : `Confirmar Asiento ${trayecto}`}
        </button>
      </div>
    </div>
  )
}
