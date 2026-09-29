import type { ScheduleEvent } from '@escape-from-home/somoim'
import { WEEKDAY_LABELS, type CalendarDay } from '../lib/calendar'
import { DayCell } from './DayCell'

interface Props {
  weeks: CalendarDay[][]
  byDate: Map<string, ScheduleEvent[]>
  today: string
  selected: string
  onSelect: (day: CalendarDay) => void
}

const EMPTY: ScheduleEvent[] = []

export function MonthGrid({ weeks, byDate, today, selected, onSelect }: Props) {
  return (
    <section className="month" aria-label="월간 일정">
      <div className="month__wd" aria-hidden>
        {WEEKDAY_LABELS.map((w, i) => (
          <span key={w} className={i === 0 ? 'is-sun' : undefined}>
            {w}
          </span>
        ))}
      </div>
      <div className="month__days">
        {weeks.flat().map((day) => (
          <DayCell
            key={day.key}
            day={day}
            events={byDate.get(day.key) ?? EMPTY}
            isToday={day.key === today}
            isSelected={day.key === selected}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
