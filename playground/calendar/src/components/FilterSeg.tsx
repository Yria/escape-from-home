import { FILTERS, type StatusFilter } from '../lib/status'

interface Props {
  value: StatusFilter
  counts: Record<StatusFilter, number>
  onChange: (v: StatusFilter) => void
}

export function FilterSeg({ value, counts, onChange }: Props) {
  return (
    <div className="seg filter-seg" role="radiogroup" aria-label="모집 상태 필터">
      {FILTERS.map((f) => (
        <label key={f.value} className={`seg-opt filter-seg__opt--${f.value}`}>
          <input type="radio" name="status-filter" checked={value === f.value} onChange={() => onChange(f.value)} />
          {f.label}
          <span className="filter-seg__n">{counts[f.value]}</span>
        </label>
      ))}
    </div>
  )
}
