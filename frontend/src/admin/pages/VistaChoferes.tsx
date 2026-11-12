import { useState } from 'react'
import { api } from '../../api'
import AddButton from '../components/AddButton'
import CardActions from '../components/CardActions'
import ChoferForm from '../components/ChoferForm'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconPhone, IconTruck } from '../components/icons'
import Modal from '../components/Modal'
import Pills from '../components/Pills'
import { useAdmin } from '../store/AdminContext'
import type { Chofer } from '../types'
import { fechaLarga, iniciales, todayISO } from '../utils/format'
import AnimatedContent from '../../reactbits/AnimatedContent'
import { ENTRADA_TARJETAS } from '../../reactbits/unab'

type Filtro = 'activos' | 'baja'
type Dialogo = { kind: 'form'; chofer?: Chofer } | { kind: 'baja'; chofer: Chofer } | null

/** Licencia vencida o por vencer en los próximos 30 días */
function estadoLicencia(iso: string): 'vencida' | 'por-vencer' | 'ok' {
  const hoy = todayISO()
  if (iso <= hoy) return 'vencida'
  const limite = new Date()
  limite.setDate(limite.getDate() + 30)
  const lim = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`
  return iso <= lim ? 'por-vencer' : 'ok'
}

export default function VistaChoferes() {
  const { state, saveChofer, toggleChofer, vanDeChofer, sincronizarConductores } = useAdmin()
  const [filtro, setFiltro] = useState<Filtro>('activos')
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [aviso, setAviso] = useState('')

  const activos = state.choferes.filter((c) => c.activo)
  const baja = state.choferes.filter((c) => !c.activo)
  const lista = filtro === 'activos' ? activos : baja
  const cerrar = () => setDialogo(null)

  // Los conductores de la base guardan RUT, licencia, celular y estado en el backend; los de ejemplo, solo aquí.
  const guardar = async (chofer: Chofer) => {
    if (chofer.idBd !== undefined) {
      const r = await api.actualizarConductor(chofer.idBd, {
        rut: chofer.rut, licenciaHasta: chofer.licenciaHasta, telefono: chofer.telefono,
      })
      if (!r.ok) return r.error
      // también actualiza el celular en el perfil del conductor
      sincronizarConductores([r.datos.conductor])
    }
    saveChofer(chofer)
    cerrar()
  }

  const cambiarEstado = async (chofer: Chofer) => {
    if (chofer.idBd !== undefined) {
      const r = await api.actualizarConductor(chofer.idBd, { activo: !chofer.activo })
      if (!r.ok) {
        setAviso(r.error)
        return
      }
    }
    setAviso('')
    toggleChofer(chofer.id)
  }

  return (
    <>
      <Pills value={filtro} onChange={setFiltro} options={[
        { value: 'activos', label: 'Activos', count: activos.length },
        { value: 'baja', label: 'Dados de baja', count: baja.length },
      ]} />
      <AddButton label="Agregar Conductor" onClick={() => setDialogo({ kind: 'form' })} />
      {aviso && <p className="adm-field__error" role="alert">{aviso}</p>}

      {/* RB-04: las tarjetas entran una tras otra; se repite al cambiar de filtro */}
      <AnimatedContent as="ul" className="adm-list" key={filtro} {...ENTRADA_TARJETAS}>
        {lista.map((c) => {
          const van = vanDeChofer(c)
          const sinDatos = !c.rut || !c.licenciaHasta
          const lic = sinDatos ? 'ok' : estadoLicencia(c.licenciaHasta)
          return (
            <li key={c.id} className="adm-card">
              <div className="adm-card__head">
                <span className="adm-card__who">
                  <span className="adm-avatar adm-avatar--light adm-avatar--sm" aria-hidden="true">{iniciales(c.nombre)}</span>
                  <span className="adm-card__title">{c.nombre}</span>
                </span>
                <span className={`adm-badge ${!c.activo ? 'adm-badge--off' : van ? 'adm-badge--ok' : 'adm-badge--pending'}`}>
                  {!c.activo ? 'De baja' : van ? 'Asignado' : 'Sin van'}
                </span>
              </div>
              <p className="adm-card__small">
                {sinDatos ? 'RUT y licencia sin registrar' : `Rut: ${c.rut} · Licencia hasta ${fechaLarga(c.licenciaHasta)}`}
              </p>
              {sinDatos && <span className="adm-tag adm-tag--warn">Faltan RUT y licencia: usa Editar</span>}
              {lic !== 'ok' && (
                <span className="adm-tag adm-tag--warn">{lic === 'vencida' ? 'Licencia vencida' : 'Licencia por vencer'}</span>
              )}
              <p className="adm-card__line adm-card__line--small">{c.correo}</p>
              {van && <p className="adm-card__line adm-card__line--small"><IconTruck size={12} />{van.patente}</p>}
              <p className="adm-card__line adm-card__line--small"><IconPhone size={11} />{c.telefono}</p>
              <CardActions
                activo={c.activo}
                onEdit={() => setDialogo({ kind: 'form', chofer: c })}
                onToggle={() => (c.activo ? setDialogo({ kind: 'baja', chofer: c }) : void cambiarEstado(c))}
              />
            </li>
          )
        })}
        {lista.length === 0 && <li className="adm-empty">No hay conductores en esta lista.</li>}
      </AnimatedContent>

      {dialogo?.kind === 'form' && (
        <Modal title={dialogo.chofer ? `Editar a ${dialogo.chofer.nombre}` : 'Agregar conductor'} onClose={cerrar}>
          <ChoferForm
            initial={dialogo.chofer}
            onCancel={cerrar}
            onSubmit={guardar}
          />
        </Modal>
      )}
      {dialogo?.kind === 'baja' && (
        <ConfirmDialog
          title="Dar de baja"
          message={`¿Dar de baja a ${dialogo.chofer.nombre}? Se desasignará de su van.`}
          confirmLabel="Dar de baja"
          onCancel={cerrar}
          onConfirm={() => { void cambiarEstado(dialogo.chofer); cerrar() }}
        />
      )}
    </>
  )
}
