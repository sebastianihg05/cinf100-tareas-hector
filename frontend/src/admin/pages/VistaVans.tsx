import { useEffect, useState } from 'react'
import AddButton from '../components/AddButton'
import CardActions from '../components/CardActions'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconPhone, IconTruck, IconUser } from '../components/icons'
import Modal from '../components/Modal'
import Pills from '../components/Pills'
import VanForm from '../components/VanForm'
import { useAdmin } from '../store/AdminContext'
import type { Van } from '../types'
import AnimatedContent from '../../reactbits/AnimatedContent'
import { ENTRADA_TARJETAS } from '../../reactbits/unab'

type Filtro = 'activas' | 'baja'
type Dialogo = { kind: 'form'; van?: Van } | { kind: 'baja'; van: Van } | null

export default function VistaVans() {
  const {
    state,
    saveVan,
    toggleVan,
    choferDeVan,
    vansCargando,
    vansGuardando,
    vansError,
    limpiarErrorVans,
    recargarVans,
  } = useAdmin()

  // #2905: las vans se piden a la API al abrir la pantalla (no hay copia guardada en el navegador).
  // Solo al entrar: recargarVans cambia en cada render.
  useEffect(() => {
    void recargarVans()
  }, [])

  const [filtro, setFiltro] = useState<Filtro>('activas')
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  const activas = state.vans.filter((v) => v.activa)
  const baja = state.vans.filter((v) => !v.activa)
  const lista = filtro === 'activas' ? activas : baja

  const cerrar = () => {
    if (vansGuardando) return
    setDialogo(null)
    limpiarErrorVans()
  }

  const guardar = async (van: Van) => {
    const guardado = await saveVan(van)
    if (guardado) cerrar()
  }

  const cambiarEstado = async (id: string) => {
    const actualizado = await toggleVan(id)
    if (actualizado) cerrar()
  }

  return (
    <>
      {vansError && (
        <div className="adm-alert adm-alert--error" role="alert">
          {vansError}
        </div>
      )}

      {vansCargando && (
        <p role="status" aria-live="polite">Cargando vans desde el servidor...</p>
      )}

      <Pills
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: 'activas', label: 'Activas', count: activas.length },
          { value: 'baja', label: 'Dadas de baja', count: baja.length },
        ]}
      />

      <AddButton
        label="Agregar van"
        onClick={() => {
          limpiarErrorVans()
          setDialogo({ kind: 'form' })
        }}
      />

      <AnimatedContent as="ul" className="adm-list" key={filtro} {...ENTRADA_TARJETAS}>
        {lista.map((v) => {
          const chofer = choferDeVan(v)

          return (
            <li key={v.id} className="adm-card">
              <div className="adm-card__head">
                <span className="adm-card__title adm-card__title--icon">
                  <IconTruck size={14} />
                  {v.patente}
                </span>

                <span className={`adm-badge ${v.activa ? 'adm-badge--ok' : 'adm-badge--off'}`}>
                  {!v.activa ? 'De baja' : chofer ? 'Asignado' : 'Sin asignar'}
                </span>
              </div>

              <p className="adm-card__strong">{v.asientos} asientos</p>
              <p className="adm-card__line">
                <IconUser size={12} />
                {chofer ? chofer.nombre : 'Sin asignar'}
              </p>

              {chofer && (
                <p className="adm-card__line">
                  <IconPhone />
                  {chofer.telefono}
                </p>
              )}

              <CardActions
                activo={v.activa}
                onEdit={() => {
                  limpiarErrorVans()
                  setDialogo({ kind: 'form', van: v })
                }}
                onToggle={() => {
                  if (v.activa) {
                    limpiarErrorVans()
                    setDialogo({ kind: 'baja', van: v })
                  } else {
                    void cambiarEstado(v.id)
                  }
                }}
              />
            </li>
          )
        })}

        {!vansCargando && lista.length === 0 && (
          <li className="adm-empty">No hay vans en esta lista.</li>
        )}
      </AnimatedContent>

      {dialogo?.kind === 'form' && (
        <Modal
          title={dialogo.van ? `Editar van ${dialogo.van.patente}` : 'Agregar van'}
          onClose={cerrar}
        >
          <VanForm
            initial={dialogo.van}
            onCancel={cerrar}
            onSubmit={guardar}
            guardando={vansGuardando}
          />
        </Modal>
      )}

      {dialogo?.kind === 'baja' && (
        <ConfirmDialog
          title="Dar de baja"
          message={`¿Dar de baja la van ${dialogo.van.patente}? Quedará sin conductor y no podrá usarse en nuevos viajes.`}
          confirmLabel={vansGuardando ? 'Guardando...' : 'Dar de baja'}
          onCancel={cerrar}
          onConfirm={() => void cambiarEstado(dialogo.van.id)}
        />
      )}
    </>
  )
}