import logoColor from '../../assets/unab-logo.svg'
import logoNegativo from '../../assets/unab-logo-negativo.svg'

type Props = {
  /** `color` para fondos claros; `negativo` (texto blanco) para fondos oscuros. */
  variante?: 'color' | 'negativo'
  /** Alto en píxeles; el ancho se ajusta solo y conserva la proporción. Una clase CSS puede cambiarlo por pantalla. */
  alto?: number
  className?: string
}

/** Símbolo institucional de la Universidad Andrés Bello (ver assets/README.md). */
export default function Logo({ variante = 'color', alto = 48, className }: Props) {
  return (
    <img
      src={variante === 'negativo' ? logoNegativo : logoColor}
      alt="Universidad Andrés Bello"
      height={alto}
      className={className}
    />
  )
}
