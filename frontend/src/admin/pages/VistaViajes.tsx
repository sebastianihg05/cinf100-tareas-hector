import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconClock, IconTruck, IconUser } from '../components/icons'
import ConfirmDialog from '../components/ConfirmDialog'
import Field from '../components/Field'
import Modal from '../components/Modal'
import Pills from '../components/Pills'
import ListaPasajerosViaje from '../components/ListaPasajerosViaje'
import { useAdmin } from '../store/AdminContext'
import { estaActiva } from '../store/reservas'
import { CAPACIDAD_VAN, type EstadoViaje, type Trayecto, type Viaje } from '../types'
import { fechaDMY, fechaLarga, todayISO } from '../utils/format'
import AnimatedContent from '../../reactbits/AnimatedContent'
import { ENTRADA_TARJETAS } from '../../reactbits/unab'

type Filtro = 'todos' | EstadoViaje
type FiltroTrayecto = 'todos' | Trayecto

const ETIQUETA: Record<EstadoViaje, string> = {
  pendiente: 'Pendiente', 'en-curso': 'En curso', completado: 'Completado', cancelado: 'Cancelado',
}

function AsignarVan({ viaje, onClose }: { viaje: Viaje; onClose: () => void }) {
  const { state, choferDeVan, asignarVanViaje } = useAdmin()
  const [vanId, setVanId] = useState('')
  const [error, setError] = useState('')

  // activas, con conductor y sin otro viaje en el mismo día y horario
  const disponibles = state.vans.filter(
    (v) => v.activa && choferDeVan(v) &&
      !state.viajes.some((x) => x.id !== viaje.id && x.estado !== 'cancelado' && x.vanId === v.id && x.fecha === viaje.fecha && x.hora === viaje.hora),
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!vanId) return setError('Selecciona una van')
    asignarVanViaje(viaje.id, vanId)
    onClose()
  }

  return (
    <form className="adm-form" onSubmit={submit} noValidate>
      <p className="adm-confirm__msg">{viaje.origen} → {viaje.destino} · {fechaDMY(viaje.fecha)} · {viaje.hora} hrs</p>
      <Field label="Van" error={error} hint={disponibles.length === 0 ? 'No hay vans disponibles en ese horario.' : 'Solo vans activas con conductor asignado'}>
        {(p) => (
          <select {...p} value={vanId} onChange={(e) => { setVanId(e.target.value); setError('') }}>
            <option value="">Selecciona una van</option>
            {disponibles.map((v) => (
              <option key={v.id} value={v.id}>{v.patente} · {choferDeVan(v)?.nombre} · {v.asientos} asientos</option>
            ))}
          </select>
        )}
      </Field>
      <div className="adm-form__actions">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancelar</button>
        <button type="submit" className="adm-btn adm-btn--primary">Asignar van</button>
      </div>
    </form>
  )
}

export default function VistaViajes() {
  const { state, setEstadoViaje, choferDeVan } = useAdmin()
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [fecha, setFecha] = useState('')
  const [trayecto, setTrayecto] = useState<FiltroTrayecto>('todos')
  const [destino, setDestino] = useState('')
  const [asignando, setAsignando] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<Viaje | null>(null)
  const [viendoPasajeros, setViendoPasajeros] = useState<Viaje | null>(null)

  const lista = state.viajes
    .filter((v) => (filtro === 'todos' || v.estado === filtro) && (!fecha || v.fecha === fecha))
    .filter((v) => (trayecto === 'todos' || v.trayecto === trayecto) && (!destino || v.destino === destino))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
  const destinos = [...new Set(state.viajes.map((v) => v.destino))].sort()
  const viajeAsignando = state.viajes.find((v) => v.id === asignando)

  return (
    <>
      <div className="adm-toolbar">
        <label className="adm-date">
          <span>Fecha</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label className="adm-date">
          <span>Destino</span>
          <select value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Todos</option>
            {destinos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <button className="adm-open-trip" onClick={() => navigate('/admin/viajes/abrir')}>Abrir viaje</button>
      </div>

      <Pills value={filtro} onChange={setFiltro} options={[
        { value: 'todos', label: 'Todos' },
        { value: 'pendiente', label: 'Pendientes' },
        { value: 'en-curso', label: 'En curso' },
        { value: 'completado', label: 'Completados' },
        { value: 'cancelado', label: 'Cancelados' },
      ]} />

      <Pills value={trayecto} onChange={setTrayecto} options={[
        { value: 'todos', label: 'Ida y vuelta' },
        { value: 'Ida', label: 'Ida' },
        { value: 'Vuelta', label: 'Vuelta' },
      ]} />

      <p className="adm-today">{fechaLarga(todayISO())} · Hoy</p>

      {/* RB-04: las tarjetas entran una tras otra; se repite al cambiar de filtro */}
      <AnimatedContent as="ul" className="adm-list" key={filtro} {...ENTRADA_TARJETAS}>
        {lista.map((v) => {
          const van = state.vans.find((x) => x.id === v.vanId)
          const chofer = van && choferDeVan(van)
          const capacidad = van?.asientos ?? CAPACIDAD_VAN
          return (
            <li key={v.id} className={`adm-card adm-card--trip${v.estado === 'cancelado' ? ' is-cancelled' : ''}`}>
              <div className="adm-card__head">
                <p className="adm-card__title">{v.origen} → {v.destino} <span className="adm-trip__date">{fechaDMY(v.fecha)}</span></p>
                <span className={`adm-state adm-state--${v.estado}`}>{ETIQUETA[v.estado]}</span>
              </div>
              <div className="adm-trip__meta">
                <span><IconClock />{v.hora} hrs</span>
                <span><IconTruck size={12} />{van?.patente ?? 'Sin van asignada'}</span>
                <span><IconUser size={12} />{chofer?.nombre ?? 'Sin asignar'}</span>
              </div>
              <p className="adm-card__small">Asientos reservados · {v.reservados}/{capacidad}</p>
              <div className="adm-progress" role="progressbar" aria-label="Asientos reservados"
                aria-valuemin={0} aria-valuemax={capacidad} aria-valuenow={v.reservados}>
                <div style={{ width: `${Math.min(100, (v.reservados / capacidad) * 100)}%` }} />
              </div>
              <div className="adm-trip__foot">
                <p className="adm-card__small">Abierto por administrador</p>
                <div className="adm-trip__btns">
                  <button type="button" className="adm-chip adm-chip--ver" onClick={() => setViendoPasajeros(v)}>
                    Ver pasajeros ({state.reservas.filter((r) => r.viajeId === v.id && estaActiva(r)).length})
                  </button>
                  {v.estado === 'pendiente' && !van && (
                    <button className="adm-chip adm-chip--warn" onClick={() => setAsignando(v.id)}>Asignar van</button>
                  )}
                  {v.estado === 'pendiente' && (
                    <button className="adm-chip adm-chip--ban" onClick={() => setCancelando(v)}>Cancelar viaje</button>
                  )}
                </div>
                {/* el conductor inicia y finaliza el viaje desde su panel; aquí solo se ve el estado */}
              </div>
            </li>
          )
        })}
        {lista.length === 0 && <li className="adm-empty">No hay viajes con ese filtro.</li>}
      </AnimatedContent>
      {cancelando && (
        <ConfirmDialog
          title="Cancelar viaje"
          message={`¿Cancelar el viaje ${cancelando.origen} → ${cancelando.destino} del ${fechaDMY(cancelando.fecha)} (${cancelando.hora} hrs)? Dejará de estar disponible para reservar.`}
          confirmLabel="Cancelar viaje"
          onCancel={() => setCancelando(null)}
          onConfirm={() => { setEstadoViaje(cancelando.id, 'cancelado'); setCancelando(null) }}
        />
      )}

      {viajeAsignando && (
        <Modal title="Asignar van y conductor" onClose={() => setAsignando(null)}>
          <AsignarVan viaje={viajeAsignando} onClose={() => setAsignando(null)} />
        </Modal>
      )}
      {viendoPasajeros && (
        <Modal title="Pasajeros del viaje" onClose={() => setViendoPasajeros(null)}>
          <ListaPasajerosViaje viaje={viendoPasajeros} />
        </Modal>
      )}
    </>
  )
}
