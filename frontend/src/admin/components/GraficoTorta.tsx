import { Link } from 'react-router-dom'
import './GraficoTorta.css'

export type Segmento = {
  etiqueta: string
  valor: number
  /** color del trozo y de su punto en la leyenda (ej. "#00a6a6") */
  color: string
  /** vista a la que lleva al tocar su leyenda */
  to: string
}

type Props = { titulo: string; segmentos: Segmento[] }

/** Torta (donut) con leyenda; cada elemento de la leyenda es un enlace. El centro muestra el total. */
export default function GraficoTorta({ titulo, segmentos }: Props) {
  const total = segmentos.reduce((suma, s) => suma + s.valor, 0)

  let acumulado = 0
  const trozos = segmentos
    .filter((s) => s.valor > 0)
    .map((s) => {
      const desde = (acumulado / total) * 100
      acumulado += s.valor
      return `${s.color} ${desde}% ${(acumulado / total) * 100}%`
    })
  const fondo = total > 0 ? `conic-gradient(${trozos.join(', ')})` : '#e6ebf1'

  const descripcion = segmentos.map((s) => `${s.valor} ${s.etiqueta.toLowerCase()}`).join(', ')

  return (
    <div className="grafico-torta">
      <div className="grafico-torta__titulo">{titulo}</div>
      <div className="grafico-torta__contenido">
        <div className="grafico-torta__anillo" style={{ background: fondo }} role="img" aria-label={`${titulo}: ${descripcion}`}>
          <div className="grafico-torta__centro">
            <span>Total</span>
            <strong>{total}</strong>
          </div>
        </div>

        <div className="grafico-torta__leyenda">
          {segmentos.map((s) => (
            <Link key={s.etiqueta} to={s.to} className="grafico-torta__item">
              <span className="grafico-torta__punto" style={{ background: s.color }} />
              {s.etiqueta} <strong>{s.valor}</strong>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
