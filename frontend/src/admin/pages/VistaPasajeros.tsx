import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconCalendar, IconChevron, IconSearch, IconSeat } from '../components/icons'
import Interruptor from '../components/Interruptor'
import Modal from '../components/Modal'
import Pills from '../components/Pills'
import { borrarCredencial } from '../../login/authDemo'
import { borrarAvisosLeidos } from '../../pasajero/useAvisosPasajero'
import { useAdmin } from '../store/AdminContext'
import { SEDES, sedeLabel, type Pasajero, type Rol } from '../types'
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

const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: 'funcionario', etiqueta: 'Funcionario' },
  { valor: 'conductor', etiqueta: 'Conductor' },
]

const etiquetaRol = (rol?: Rol) => ROLES.find((r) => r.valor === (rol ?? 'funcionario'))!.etiqueta

export default function VistaPasajeros() {
  const { state, pendientes, patchPasajero, aprobarSolicitud, rechazarSolicitud, eliminarPasajero } = useAdmin()
  const [params, setParams] = useSearchParams()
  const [detalle, setDetalle] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  // rol elegido para cada solicitud mientras sigue por aprobar (por defecto, funcionario)
  const [roles, setRoles] = useState<Record<string, Rol>>({})
  const [rechazando, setRechazando] = useState<Pasajero | null>(null)
  const [eliminando, setEliminando] = useState<Pasajero | null>(null)

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
          <li key={p.id} className={`adm-card adm-card--passenger${p.aprobado ? ' is-clickable' : ' adm-card--solicitud'}`}
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
              <div className="adm-solicitud">
                <label className="adm-solicitud__rol">
                  <span>Rol</span>
                  <select value={roles[p.id] ?? 'funcionario'} aria-label={`Rol de ${p.nombre}`}
                    onChange={(e) => setRoles({ ...roles, [p.id]: e.target.value as Rol })}>
                    {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
                  </select>
                </label>
                <button className="adm-reject" onClick={() => setRechazando(p)}>Rechazar</button>
                <button className="adm-approve" onClick={() => aprobarSolicitud(p.id, roles[p.id] ?? 'funcionario')}>Aprobar</button>
              </div>
            )}
          </li>
        ))}
        {lista.length === 0 && <li className="adm-empty">No hay pasajeros que coincidan.</li>}
      </ul>

      {rechazando && (
        <ConfirmDialog
          title="Rechazar solicitud"
          message={`¿Rechazar la solicitud de ${rechazando.nombre}? Se eliminará y la persona tendrá que registrarse de nuevo.`}
          confirmLabel="Rechazar"
          onCancel={() => setRechazando(null)}
          onConfirm={() => { rechazarSolicitud(rechazando.id); setRechazando(null) }}
        />
      )}

      {sel && (
        <Modal title={sel.nombre} onClose={() => setDetalle(null)}>
          <p className="adm-detail__mail">{sel.email}</p>
          <dl className="adm-detail__list">
            <div><dt>Rol</dt><dd>{etiquetaRol(sel.rol)}</dd></div>
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

          {/* La aprobación se hace una sola vez: después ya no se revierte (para quitarle el acceso se elimina la cuenta). */}
          <div className="adm-switch-row">
            <div>
              <strong>Cuenta aprobada</strong>
              <small>Puede reservar asientos. Se aprueba una sola vez.</small>
            </div>
            <span className="adm-badge adm-badge--ok">Aprobada</span>
          </div>
          <Interruptor titulo="Puede abrir viajes" descripcion="Para la Dirección de Docencia: abre viajes en días sin viaje fijo."
            activo={sel.puedeAbrirViajes} onChange={(v) => patchPasajero(sel.id, { puedeAbrirViajes: v })} />
          <div className="adm-switch-row">
            <div>
              <strong>Eliminar cuenta</strong>
              <small>Borra la cuenta y sus reservas del almacenamiento para liberar espacio. No se puede deshacer.</small>
            </div>
            <button type="button" className="adm-btn adm-btn--danger" onClick={() => setEliminando(sel)}>Eliminar</button>
          </div>
        </Modal>
      )}

      {eliminando && (
        <ConfirmDialog
          title="Eliminar cuenta"
          message={`¿Eliminar la cuenta de ${eliminando.nombre}? Se borrarán la cuenta, su contraseña y todas sus reservas, y no se puede deshacer.`}
          confirmLabel="Eliminar cuenta"
          onCancel={() => setEliminando(null)}
          onConfirm={() => {
            eliminarPasajero(eliminando.id)
            borrarCredencial(eliminando.email)
            borrarAvisosLeidos(eliminando.id)
            setEliminando(null)
            setDetalle(null)
          }}
        />
      )}
    </>
  )
}
