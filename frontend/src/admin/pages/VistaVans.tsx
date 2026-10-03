import { useState } from 'react'
import AddButton from '../components/AddButton'
import CardActions from '../components/CardActions'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconPhone, IconTruck, IconUser } from '../components/icons'
import Modal from '../components/Modal'
import Pills from '../components/Pills'
import VanForm from '../components/VanForm'
import { useAdmin } from '../store/AdminContext'
import type { Van } from '../types'

type Filtro = 'activas' | 'baja'
type Dialogo = { kind: 'form'; van?: Van } | { kind: 'baja'; van: Van } | null

export default function VistaVans() {
  const { state, saveVan, toggleVan, choferDeVan } = useAdmin()
  const [filtro, setFiltro] = useState<Filtro>('activas')
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  const activas = state.vans.filter((v) => v.activa)
  const baja = state.vans.filter((v) => !v.activa)
  const lista = filtro === 'activas' ? activas : baja
  const cerrar = () => setDialogo(null)

  return (
    <>
      <Pills value={filtro} onChange={setFiltro} options={[
        { value: 'activas', label: 'Activas', count: activas.length },
        { value: 'baja', label: 'Dadas de baja', count: baja.length },
      ]} />
      <AddButton label="Agregar van" onClick={() => setDialogo({ kind: 'form' })} />

      <ul className="adm-list">
        {lista.map((v) => {
          const chofer = choferDeVan(v)
          return (
            <li key={v.id} className="adm-card">
              <div className="adm-card__head">
                <span className="adm-card__title adm-card__title--icon"><IconTruck size={14} />{v.patente}</span>
                <span className={`adm-badge ${v.activa ? 'adm-badge--ok' : 'adm-badge--off'}`}>{v.activa ? 'Asignado' : 'De baja'}</span>
              </div>
              <p className="adm-card__strong">{v.asientos} asientos</p>
              <p className="adm-card__line"><IconUser size={12} />{chofer ? chofer.nombre : 'Sin conductor'}</p>
              {chofer && <p className="adm-card__line"><IconPhone />{chofer.telefono}</p>}
              <CardActions
                activo={v.activa}
                onEdit={() => setDialogo({ kind: 'form', van: v })}
                onToggle={() => (v.activa ? setDialogo({ kind: 'baja', van: v }) : toggleVan(v.id))}
              />
            </li>
          )
        })}
        {lista.length === 0 && <li className="adm-empty">No hay vans en esta lista.</li>}
      </ul>

      {dialogo?.kind === 'form' && (
        <Modal title={dialogo.van ? `Editar van ${dialogo.van.patente}` : 'Agregar van'} onClose={cerrar}>
          <VanForm initial={dialogo.van} onCancel={cerrar} onSubmit={(van) => { saveVan(van); cerrar() }} />
        </Modal>
      )}
      {dialogo?.kind === 'baja' && (
        <ConfirmDialog
          title="Dar de baja"
          message={`¿Dar de baja la van ${dialogo.van.patente}? Quedará sin conductor y no podrá usarse en nuevos viajes.`}
          confirmLabel="Dar de baja"
          onCancel={cerrar}
          onConfirm={() => { toggleVan(dialogo.van.id); cerrar() }}
        />
      )}
    </>
  )
}
