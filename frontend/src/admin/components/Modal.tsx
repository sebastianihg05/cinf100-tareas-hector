import { useEffect, useRef, type ReactNode } from 'react'
import { IconClose } from './icons'

type Props = { title: string; onClose: () => void; children: ReactNode }

export default function Modal({ title, onClose, children }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    bodyRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previo?.focus?.()
    }
  }, [])

  return (
    <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="adm-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="adm-modal__head">
          <h2>{title}</h2>
          <button className="adm-modal__close" onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        </header>
        <div className="adm-modal__body" ref={bodyRef}>{children}</div>
      </div>
    </div>
  )
}
