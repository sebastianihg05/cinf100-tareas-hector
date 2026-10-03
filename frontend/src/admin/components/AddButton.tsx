import { IconPlus } from './icons'

export default function AddButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button className="adm-add" onClick={onClick}>{label}<IconPlus /></button>
  )
}
