import { IconBan, IconEdit } from './icons'

type Props = { activo: boolean; onEdit?: () => void; onToggle: () => void }

export default function CardActions({ activo, onEdit, onToggle }: Props) {
  return (
    <div className="adm-actions">
      <button className="adm-chip adm-chip--edit" onClick={onEdit}><IconEdit /> Editar</button>
      <button className="adm-chip adm-chip--ban" onClick={onToggle}>
        <IconBan /> {activo ? 'Dar de baja' : 'Reactivar'}
      </button>
    </div>
  )
}
