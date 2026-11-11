import type { ReactNode } from 'react'

type Props = {
  capacidad: number
  /** números de asiento ya tomados */
  ocupados: number[]
  seleccionado?: number
  onSeleccionar: (asiento: number) => void
}

type Celda = number | 'conductor' | 'copiloto'

/**
 * Disposición de la Minivan Hyundai Staria: la primera fila lleva al conductor y el asiento del copiloto
 * (que no se puede reservar); luego vienen filas de 2 asientos y una última de hasta 3.
 * Con 9 asientos queda: [C, copiloto] [1,2] [3,4] [5,6] [7,8,9].
 */
export function disponerAsientos(capacidad: number): Celda[][] {
  const total = Math.max(0, Math.floor(capacidad))
  if (total === 0) return []
  const filas: Celda[][] = [['conductor', 'copiloto']]
  let siguiente = 1
  while (siguiente <= total) {
    const restantes = total - siguiente + 1
    const tam = restantes <= 3 ? restantes : 2
    filas.push(Array.from({ length: tam }, (_, i) => siguiente + i))
    siguiente += tam
  }
  return filas
}

const modoFila = (fila: Celda[], indice: number) =>
  indice === 0 ? 'conductor' : fila.length === 3 ? 'triple' : fila.length === 2 ? 'par' : 'solo'

function Butaca({ children }: { children?: ReactNode }) {
  return (
    <>
      <span className="psj-asiento__resp" aria-hidden="true" />
      <span className="psj-asiento__base">{children}</span>
    </>
  )
}

function IconoConductor() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.4 6.2A3.6 3.6 0 0 1 12 3a3.6 3.6 0 0 1 3.6 3.2" />
      <path d="M7.6 6.6h8.8" />
      <circle cx="12" cy="9.2" r="2.6" />
      <path d="M12 12.2v2.2" />
      <circle cx="6.4" cy="17.4" r="2" />
      <circle cx="12" cy="17.4" r="2" />
      <circle cx="17.6" cy="17.4" r="2" />
    </svg>
  )
}

export default function MapaAsientos({ capacidad, ocupados, seleccionado, onSeleccionar }: Props) {
  const filas = disponerAsientos(capacidad)

  return (
    <section className="psj-mapa" aria-label="Mapa de asientos de la van">
      <div className="psj-van" role="radiogroup" aria-label="Selecciona tu asiento">
        {filas.map((fila, i) => (
          <div key={i} className={`psj-van__fila psj-van__fila--${modoFila(fila, i)}`}>
            {fila.map((celda) => {
              if (celda === 'copiloto') {
                return (
                  <div key="copiloto" className="psj-asiento psj-asiento--copiloto" role="img" aria-label="Asiento del copiloto, no disponible">
                    <Butaca />
                  </div>
                )
              }
              if (celda === 'conductor') {
                return (
                  <div key="conductor" className="psj-asiento psj-asiento--conductor" role="img" aria-label="Conductor">
                    <Butaca><IconoConductor /></Butaca>
                  </div>
                )
              }
              const ocupado = ocupados.includes(celda)
              const elegido = seleccionado === celda
              const estado = ocupado ? 'ocupado' : elegido ? 'seleccionado' : 'libre'
              return (
                <button key={celda} type="button" role="radio" aria-checked={elegido} disabled={ocupado}
                  aria-label={ocupado ? `Asiento ${celda}, ocupado` : `Asiento ${celda}`}
                  className={`psj-asiento psj-asiento--${estado}`} onClick={() => onSeleccionar(celda)}>
                  <Butaca>
                    {ocupado ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                    ) : celda}
                  </Butaca>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <ul className="psj-leyenda" aria-label="Leyenda">
        <li><span className="psj-leyenda__color psj-leyenda__color--libre" aria-hidden="true" />Disponible</li>
        <li><span className="psj-leyenda__color psj-leyenda__color--ocupado" aria-hidden="true" />Ocupado</li>
        <li><span className="psj-leyenda__color psj-leyenda__color--seleccionado" aria-hidden="true" />Seleccionado</li>
      </ul>
    </section>
  )
}
