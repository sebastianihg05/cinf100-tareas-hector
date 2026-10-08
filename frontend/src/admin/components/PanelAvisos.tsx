import { useEffect } from 'react'

export type Aviso = {
  id: string
  titulo: string
  /** líneas de detalle bajo el título */
  lineas: string[]
  sinLeer: boolean
  /** qué pasa al tocar el aviso (marcarlo leído, ir a la vista...) */
  onSeleccionar: () => void
}

type Props = {
  avisos: Aviso[]
  /** cantidad de avisos sin leer: si es > 0 aparece "Marcar como leídas" */
  sinLeer: number
  vacio?: string
  onMarcarLeidas: () => void
  onClose: () => void
}

/** Panel desplegable de la campana de notificaciones. Lo usan el administrador y el funcionario. */
export default function PanelAvisos({ avisos, sinLeer, vacio = 'No tienes notificaciones.', onMarcarLeidas, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="adm-notif-backdrop" onClick={onClose} />
      <div className="adm-notif" role="dialog" aria-label="Notificaciones">
        <header className="adm-notif__head">
          <h2>Notificaciones</h2>
          {sinLeer > 0 && <button onClick={onMarcarLeidas}>Marcar como leídas</button>}
        </header>

        <ul className="adm-notif__list">
          {avisos.map((a) => (
            <li key={a.id}>
              <button className={`adm-notif__item${a.sinLeer ? ' is-unread' : ''}`} onClick={a.onSeleccionar}>
                <strong>{a.titulo}</strong>
                {a.lineas.map((l) => <small key={l}>{l}</small>)}
              </button>
            </li>
          ))}
          {avisos.length === 0 && <li className="adm-empty">{vacio}</li>}
        </ul>
      </div>
    </>
  )
}
