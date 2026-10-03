type Props = { titulo: string; descripcion: string; activo: boolean; onChange: (v: boolean) => void }

export default function Interruptor({ titulo, descripcion, activo, onChange }: Props) {
  return (
    <div className="adm-switch-row">
      <div>
        <strong>{titulo}</strong>
        <small>{descripcion}</small>
      </div>
      <button type="button" role="switch" aria-checked={activo} aria-label={titulo}
        className={`adm-switch${activo ? ' is-on' : ''}`} onClick={() => onChange(!activo)}>
        <span />
      </button>
    </div>
  )
}
