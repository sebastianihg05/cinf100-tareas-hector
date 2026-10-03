import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { IconCalendar, IconChevron, IconSearch, IconSeat } from '../components/icons'
import Interruptor from '../components/Interruptor'
import Modal from '../components/Modal'
import Pills from '../components/Pills'
import { useAdmin } from '../store/AdminContext'
import { SEDES, sedeLabel, type Pasajero } from '../types'
import { fechaCorta, fechaHora, fechaLarga, iniciales, sinTildes } from '../utils/format'

function TagsReserva({ p }: { p: Pasajero }) {
  const { reserva } = p
  return (
    <div className="adm-tags">
      {reserva ? (
        <>
          <span className="adm-tag adm-tag--date"><IconCalendar />{fechaCorta(reserva.fecha)} · {reserva.trayecto}</span>
          <span className="adm-tag adm-tag--seat"><IconSeat />Asiento {reserva.asiento}</span>
        </>
      ) : (
        <span className="adm-tag adm-tag--none">Sin viaje reservado</span>
      )}
      {!p.habilitado && <span className="adm-tag adm-tag--warn">Deshabilitada</span>}
    </div>
  )
}

export default function VistaPasajeros() {
  const { state, pendientes, patchPasajero } = useAdmin()
  const [params, setParams] = useSearchParams()
  const [detalle, setDetalle] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const filtro = params.get('filtro') ?? 'todos'
  const setFiltro = (f: string) => setParams(f === 'todos' ? {} : { filtro: f }, { replace: true })

  const q = sinTildes(busqueda.trim())
  const lista = state.pasajeros.filter((p) => {
    if (filtro === 'por-aprobar' && p.aprobado) return false
    if (filtro !== 'todos' && filtro !== 'por-aprobar' && p.sede !== filtro) return false
    return !q || sinTildes(`${p.nombre} ${p.email} ${p.sede}`).includes(q)
  })
  const sel = state.pasajeros.find((p) => p.id === detalle)

  return (
    <>
      <label className="adm-search">
        <IconSearch />
        <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, correo o sede" aria-label="Buscar pasajeros" />
      </label>

      <Pills scroll value={filtro} onChange={setFiltro} options={[
        { value: 'todos', label: 'Todos' },
        { value: 'por-aprobar', label: 'Por aprobar', count: pendientes, alert: true },
        ...SEDES.map((s) => ({ value: s as string, label: s })),
      ]} />

      <ul className="adm-list">
        {lista.map((p) => (
          <li key={p.id} className={`adm-card adm-card--passenger${p.aprobado ? ' is-clickable' : ''}`}
            onClick={p.aprobado ? () => setDetalle(p.id) : undefined}>
            <div className="adm-avatar adm-avatar--light">{iniciales(p.nombre)}</div>
            <div className="adm-passenger__body">
              <p className="adm-card__title">{p.nombre}</p>
              <p className="adm-card__small">{p.email} · {p.sede || 'Sin sede'}</p>
              {p.aprobado
                ? <TagsReserva p={p} />
                : <span className="adm-badge adm-badge--pending">Por aprobar</span>}
            </div>
            {p.aprobado ? (
              <button className="adm-passenger__go" aria-label={`Ver detalle de ${p.nombre}`}
                onClick={(e) => { e.stopPropagation(); setDetalle(p.id) }}><IconChevron /></button>
            ) : (
              <button className="adm-approve" onClick={() => patchPasajero(p.id, { aprobado: true })}>Aprobar</button>
            )}
          </li>
        ))}
        {lista.length === 0 && <li className="adm-empty">No hay pasajeros que coincidan.</li>}
      </ul>

      {sel && (
        <Modal title={sel.nombre} onClose={() => setDetalle(null)}>
          <p className="adm-detail__mail">{sel.email}</p>
          <dl className="adm-detail__list">
            <div><dt>Sede</dt><dd>{sel.sede ? sedeLabel(sel.sede) : 'Sin sede'}</dd></div>
            <div><dt>Celular</dt><dd><a href={`tel:${sel.celular.replace(/\s/g, '')}`}>{sel.celular}</a></dd></div>
            <div><dt>Último ingreso</dt><dd>{fechaHora(sel.ultimoIngreso)}</dd></div>
            {sel.reserva && (
              <div>
                <dt>Próximo viaje</dt>
                <dd>{fechaLarga(sel.reserva.fecha)} · {sel.reserva.trayecto} · Asiento {sel.reserva.asiento}</dd>
              </div>
            )}
          </dl>

          {/* La aprobación se hace una sola vez: después ya no se revierte (para bloquear el acceso está "Cuenta habilitada"). */}
          <div className="adm-switch-row">
            <div>
              <strong>Cuenta aprobada</strong>
              <small>Puede reservar asientos. Se aprueba una sola vez.</small>
            </div>
            <span className="adm-badge adm-badge--ok">Aprobada</span>
          </div>
          <Interruptor titulo="Puede abrir viajes" descripcion="Para la Dirección de Docencia: abre viajes en días sin viaje fijo."
            activo={sel.puedeAbrirViajes} onChange={(v) => patchPasajero(sel.id, { puedeAbrirViajes: v })} />
          <Interruptor titulo="Cuenta habilitada" descripcion="Si se deshabilita, no puede ingresar al sistema."
            activo={sel.habilitado} onChange={(v) => patchPasajero(sel.id, { habilitado: v })} />
        </Modal>
      )}
    </>
  )
}
