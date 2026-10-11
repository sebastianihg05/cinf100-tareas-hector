import { Link } from 'react-router-dom'
import './ListaResumen.css'

export type ItemResumen = { clave: string; principal: string; secundario: string; valor?: string; to: string }

type Props = { titulo: string; subtitulo: string; items: ItemResumen[]; vacio: string }

/** Listado corto del panel; cada fila es un enlace al detalle. */
export default function ListaResumen({ titulo, subtitulo, items, vacio }: Props) {
  return (
    <section className="lista-resumen" aria-label={titulo}>
      <h3>{titulo}</h3>
      <p className="lista-resumen__sub">{subtitulo}</p>

      {items.length === 0 ? (
        <p className="lista-resumen__vacio">{vacio}</p>
      ) : (
        <ol className="lista-resumen__lista">
          {items.map((i) => (
            <li key={i.clave}>
              <Link to={i.to} className="lista-resumen__fila">
                <span className="lista-resumen__texto">
                  <strong>{i.principal}</strong>
                  <small>{i.secundario}</small>
                </span>
                {i.valor && <span className="lista-resumen__valor">{i.valor}</span>}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
