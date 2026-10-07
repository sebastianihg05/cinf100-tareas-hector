import { Link } from 'react-router-dom'
import './GraficoBarras.css'

export type TonoBarra = 'amarillo' | 'azul' | 'turquesa' | 'rojo' | 'gris' | 'navy'

export type Barra = {
  clave: string
  etiqueta: string
  /** 0 a 100 */
  porcentaje: number
  /** texto a la derecha de la barra (ej. "3" o "3/8") */
  valor: string
  /** vista a la que lleva al tocar la barra */
  to: string
  tono: TonoBarra
}

type Props = { titulo: string; subtitulo: string; barras: Barra[]; vacio: string }

/** Gráfico de barras horizontales; cada barra es un enlace al detalle. */
export default function GraficoBarras({ titulo, subtitulo, barras, vacio }: Props) {
  return (
    <section className="grafico-barras" aria-label={titulo}>
      <h3>{titulo}</h3>
      <p className="grafico-barras__sub">{subtitulo}</p>

      {barras.length === 0 ? (
        <p className="grafico-barras__vacio">{vacio}</p>
      ) : (
        <ul className="grafico-barras__lista">
          {barras.map((b) => (
            <li key={b.clave}>
              <Link to={b.to} className="grafico-barras__barra" aria-label={`${b.etiqueta}: ${b.valor}. Ver detalle`}>
                <span className="grafico-barras__etiqueta">{b.etiqueta}</span>
                <span className="grafico-barras__pista" aria-hidden="true">
                  <span className={`grafico-barras__relleno grafico-barras__relleno--${b.tono}`}
                    style={{ width: `${b.porcentaje <= 0 ? 0 : Math.max(b.porcentaje, 4)}%` }} />
                </span>
                <span className="grafico-barras__valor">{b.valor}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
