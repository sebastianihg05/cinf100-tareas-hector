import Modal from './Modal'

type Props = {
  title: string
  message: string
  confirmLabel: string
  /** texto del botón que no confirma (por defecto "Cancelar") */
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, confirmLabel, cancelLabel = 'Cancelar', onConfirm, onCancel }: Props) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="adm-confirm__msg">{message}</p>
      <div className="adm-form__actions">
        <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="adm-btn adm-btn--danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
