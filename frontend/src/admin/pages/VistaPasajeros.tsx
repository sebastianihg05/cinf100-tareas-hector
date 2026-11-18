import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import ConfirmDialog from '../components/ConfirmDialog'
import DetalleReservasPasajero from '../components/DetalleReservasPasajero'
import { IconCalendar, IconChevron, IconSearch, IconSeat } from '../components/icons'
import Interruptor from '../components/Interruptor'
import Modal from '../components/Modal'
import Pills from '../components/Pills'
import { useAdmin } from '../store/AdminContext'
import { RUTA_TRAYECTO, SEDES, sedeLabel, type Pasajero, type Rol } from '../types'
import { fechaCorta, fechaDMY, fechaHora, fechaLarga, iniciales, sinTildes } from '../utils/format'
import AnimatedContent from '../../reactbits/AnimatedContent'
import { ENTRADA_TARJETAS } from '../../reactbits/unab'

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
  const { state, pendientes, patchPasajero, aprobarSolicitud, rechazarSolicitud, eliminarPasajero, reservasDe, sincronizarCuentas, sincronizarConductores } = useAdmin()
  const [params, setParams] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [fechaViaje, setFechaViaje] = useState('')
  // rol elegido para cada solicitud mientras sigue por aprobar (por defecto, funcionario)
  const [roles, setRoles] = useState<Record<string, Rol>>({})
  const [rechazando, setRechazando] = useState<Pasajero | null>(null)
  const [eliminando, setEliminando] = useState<Pasajero | null>(null)
  const [aviso, setAviso] = useState('')

  // Las cuentas de la base se aprueban o rechazan en el backend (BD-15, BD-16); las de ejemplo, solo aquí.
  const aprobar = async (p: Pasajero) => {
    const rol = roles[p.id] ?? 'funcionario'
    if (p.idBd === undefined) return aprobarSolicitud(p.id, rol)
    const r = await api.aprobar(p.idBd, rol)
    if (r.ok) sincronizarCuentas([r.datos.usuario])
    setAviso(r.ok ? '' : r.error)
    // Un conductor recién aprobado aparece de inmediato en Choferes.
    if (r.ok && rol === 'conductor') {
      const c = await api.listarConductores()
      if (c.ok) sincronizarConductores(c.datos.conductores)
    }
  }

  const rechazar = async (p: Pasajero) => {
    if (p.idBd === undefined) return rechazarSolicitud(p.id)
    const r = await api.rechazar(p.idBd)
    if (r.ok) sincronizarCuentas([r.datos.usuario])
    setAviso(r.ok ? '' : r.error)
  }

  const filtro = params.get('filtro') ?? 'todos'
  // HU-16: la selección vive en la URL para conservar el pasajero al entrar al historial.
  const detalle = params.get('pasajero')
  const vistaDetalle = params.get('vista') === 'reservas' ? 'reservas' : 'perfil'

  const setFiltro = (f: string) => setParams((anterior) => {
    const siguiente = new URLSearchParams(anterior)
    if (f === 'todos') siguiente.delete('filtro')
    else siguiente.set('filtro', f)
    return siguiente
  }, { replace: true })

  const abrirDetalle = (id: string, vista: 'perfil' | 'reservas' = 'perfil') => setParams((anterior) => {
    const siguiente = new URLSearchParams(anterior)
    siguiente.set('pasajero', id)
    if (vista === 'reservas') siguiente.set('vista', 'reservas')
    else siguiente.delete('vista')
    return siguiente
  })

  const cerrarDetalle = () => setParams((anterior) => {
    const siguiente = new URLSearchParams(anterior)
    siguiente.delete('pasajero')
    siguiente.delete('vista')
    return siguiente
  })

  const q = sinTildes(busqueda.trim())
  const lista = state.pasajeros.filter((p) => {
    if (filtro === 'por-aprobar' && p.aprobado) return false
    if (filtro !== 'todos' && filtro !== 'por-aprobar' && p.sede !== filtro) return false
    if (fechaViaje && p.reserva?.fecha !== fechaViaje) return false
    const viaje = p.reserva ? `${p.reserva.fecha} ${fechaDMY(p.reserva.fecha)} ${RUTA_TRAYECTO[p.reserva.trayecto].destino}` : ''
    return !q || sinTildes(`${p.nombre} ${p.email} ${p.sede} ${viaje}`).includes(q)
  })
  const sel = state.pasajeros.find((p) => p.id === detalle && p.aprobado)
  const reservasSeleccionadas = sel ? reservasDe(sel.id) : null

  return (
    <>
      <label className="adm-search">
        <IconSearch />
        <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Nombre, correo, sede o destino" aria-label="Buscar pasajeros" />
      </label>

      <label className="adm-date adm-date--fila">
        <span>Fecha del viaje</span>
        <input type="date" value={fechaViaje} onChange={(e) => setFechaViaje(e.target.value)} />
      </label>

      <Pills scroll value={filtro} onChange={setFiltro} options={[
        { value: 'todos', label: 'Todos' },
        { value: 'por-aprobar', label: 'Por aprobar', count: pendientes, alert: true },
        ...SEDES.map((s) => ({ value: s as string, label: s })),
      ]} />

      {aviso && <p className="adm-field__error" role="alert">{aviso}</p>}

      {/* RB-04: las tarjetas entran una tras otra; se repite al cambiar de filtro */}
      <AnimatedContent as="ul" className="adm-list" key={filtro} {...ENTRADA_TARJETAS}>
        {lista.map((p) => (
          <li key={p.id} className={`adm-card adm-card--passenger${p.aprobado ? ' is-clickable' : ' adm-card--solicitud'}`}
            onClick={p.aprobado ? () => abrirDetalle(p.id) : undefined}>
            <div className="adm-avatar adm-avatar--light">{iniciales(p.nombre)}</div>
            <div className="adm-passenger__body">
              <p className="adm-card__title">{p.nombre}</p>
              <p className="adm-card__small">{p.email} · {p.sede || 'Sin sede'}</p>
              {p.aprobado
                ? <>
                    <TagsReserva p={p} />
                    <button type="button" className="adm-passenger__reservas"
                      aria-label={`Ver reservas de ${p.nombre}`}
                      onClick={(e) => { e.stopPropagation(); abrirDetalle(p.id, 'reservas') }}>
                      Ver reservas
                    </button>
                  </>
                : <span className="adm-badge adm-badge--pending">Por aprobar</span>}
            </div>
            {p.aprobado ? (
              <button className="adm-passenger__go" aria-label={`Ver detalle de ${p.nombre}`}
                onClick={(e) => { e.stopPropagation(); abrirDetalle(p.id) }}><IconChevron /></button>
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
                <button className="adm-approve" onClick={() => aprobar(p)}>Aprobar</button>
              </div>
            )}
          </li>
        ))}
        {lista.length === 0 && <li className="adm-empty">No hay pasajeros que coincidan.</li>}
      </AnimatedContent>

      {rechazando && (
        <ConfirmDialog
          title="Rechazar solicitud"
          message={`¿Rechazar la solicitud de ${rechazando.nombre}? Se eliminará y la persona tendrá que registrarse de nuevo.`}
          confirmLabel="Rechazar"
          onCancel={() => setRechazando(null)}
          onConfirm={() => { rechazar(rechazando); setRechazando(null) }}
        />
      )}

      {sel && (
        <Modal title={sel.nombre} onClose={cerrarDetalle}>
          {vistaDetalle === 'reservas' && reservasSeleccionadas ? (
            <DetalleReservasPasajero pasajero={sel}
              proximas={reservasSeleccionadas.proximas}
              historial={reservasSeleccionadas.historial}
              onVolver={() => abrirDetalle(sel.id)} />
          ) : <>
          <button type="button" className="adm-btn adm-btn--primary adm-reservas__abrir"
            onClick={() => abrirDetalle(sel.id, 'reservas')}>
            Ver todas sus reservas
          </button>
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
          {/* Solo las cuentas de ejemplo: el backend todavía no tiene una ruta para dar de baja una cuenta. */}
          {sel.idBd === undefined && (
            <div className="adm-switch-row">
              <div>
                <strong>Eliminar cuenta</strong>
                <small>Borra la cuenta y sus reservas del almacenamiento para liberar espacio. No se puede deshacer.</small>
              </div>
              <button type="button" className="adm-btn adm-btn--danger" onClick={() => setEliminando(sel)}>Eliminar</button>
            </div>
          )}
          </>}
        </Modal>
      )}

      {eliminando && (
        <ConfirmDialog
          title="Eliminar cuenta"
          message={`¿Eliminar la cuenta de ${eliminando.nombre}? Se borrarán la cuenta y todas sus reservas, y no se puede deshacer.`}
          confirmLabel="Eliminar cuenta"
          onCancel={() => setEliminando(null)}
          onConfirm={() => {
            eliminarPasajero(eliminando.id)
            setEliminando(null)
            cerrarDetalle()
          }}
        />
      )}
    </>
  )
}