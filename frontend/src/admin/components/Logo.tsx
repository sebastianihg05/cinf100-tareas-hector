import logoColor from '../../assets/unab-logo.svg'
import logoNegativo from '../../assets/unab-logo-negativo.svg'
import simboloNegativo from '../../assets/unab-simbolo-negativo.svg'

const IMAGENES = { color: logoColor, negativo: logoNegativo, simbolo: simboloNegativo }

type Props = {
  /**
   * `color` para fondos claros; `negativo` (texto blanco) para fondos oscuros;
   * `simbolo` (solo el escudo, para fondos oscuros) donde el texto quedaría ilegible, como los encabezados.
   */
  variante?: keyof typeof IMAGENES
  /** Alto en píxeles; el ancho se ajusta solo y conserva la proporción. Una clase CSS puede cambiarlo por pantalla. */
  alto?: number
  className?: string
}

/** Símbolo institucional de la Universidad Andrés Bello (ver assets/README.md). */
export default function Logo({ variante = 'color', alto = 48, className }: Props) {
  return (
    <img
      src={IMAGENES[variante]}
      alt="Universidad Andrés Bello"
      height={alto}
      className={className}
    />
  )
}
