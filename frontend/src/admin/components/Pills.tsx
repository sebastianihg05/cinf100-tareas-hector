export type PillOption<T extends string> = {
  value: T
  label: string
  count?: number
  /** el contador se muestra como insignia roja y solo si es > 0 */
  alert?: boolean
}

type Props<T extends string> = {
  options: PillOption<T>[]
  value: T
  onChange: (v: T) => void
  /** en celular los filtros se desplazan en horizontal en vez de saltar de línea */
  scroll?: boolean
}

export default function Pills<T extends string>({ options, value, onChange, scroll }: Props<T>) {
  return (
    <div className={`adm-pills${scroll ? ' adm-pills--scroll' : ''}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value}
          className={`adm-pill${o.value === value ? ' is-active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && !o.alert && <>{' '}<span>({o.count})</span></>}
          {o.count !== undefined && o.alert && o.count > 0 && <>{' '}<span className="adm-pill__badge">{o.count}</span></>}
        </button>
      ))}
    </div>
  )
}
