import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './Indicador.css'

type Props = {
  /** vista a la que lleva al tocarlo */
  to: string
  etiqueta: string
  valor: number | string
  /** `tarjeta`: etiqueta arriba e ícono en la esquina. `conteo`: número grande centrado. */
  variante?: 'tarjeta' | 'conteo'
  tono?: 'navy' | 'blue' | 'yellow' | 'turquoise'
  icono?: ReactNode
}

/** Cifra clave que lleva a la vista donde se gestiona ese dato. */
export default function Indicador({ to, etiqueta, valor, variante = 'tarjeta', tono = 'navy', icono }: Props) {
  return (
    <Link to={to} className={`indicador indicador--${variante} indicador--${tono}`}>
      <span className="indicador__etiqueta">{etiqueta}</span>
      <strong className="indicador__valor">{valor}</strong>
      {icono && <span className="indicador__icono" aria-hidden="true">{icono}</span>}
    </Link>
  )
}
