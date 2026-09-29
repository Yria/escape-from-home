import { useMemo, useState } from 'react'
import type { ScheduleEvent } from '@escape-from-home/somoim'
import { CircleNotchIcon, WarningIcon } from '@phosphor-icons/react'
import {
  addMonths,
  buildMonthGrid,
  groupByDate,
  isSameMonth,
  kstYearMonth,
  toDateKey,
  type CalendarDay,
  type YearMonth,
} from './lib/calendar'
import { countByStatus, matchesFilter, type StatusFilter } from './lib/status'
import { useSnapshot } from './hooks/useSnapshot'
import { useToday } from './hooks/useToday'
import { Header } from './components/Header'
import { FilterSeg } from './components/FilterSeg'
import { MonthGrid } from './components/MonthGrid'
import { DayAgenda } from './components/DayAgenda'
import { EventSheet, type SheetItem } from './components/EventSheet'
import { UndatedList } from './components/UndatedList'

const NO_EVENTS: ScheduleEvent[] = []

export default function App() {
  const { phase, snapshot, error, refreshing, refresh } = useSnapshot()
  const today = useToday()
  const [month, setMonth] = useState<YearMonth>(() => kstYearMonth(new Date()))
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [picked, setPicked] = useState<string | null>(null)
  const [openEvent, setOpenEvent] = useState<SheetItem | null>(null)

  const events = snapshot?.events ?? NO_EVENTS
  const weeks = useMemo(() => buildMonthGrid(month), [month])
  const monthEvents = useMemo(() => {
    const keys = new Set(weeks.flat().map((d) => d.key))
    return events.filter((e) => keys.has(e.date))
  }, [events, weeks])
  // 필터 숫자는 보고 있는 달과 상관없이 받아 온 전체(날짜 미확인 글 포함) 기준
  const counts = useMemo(() => countByStatus([...events, ...(snapshot?.undated ?? [])]), [events, snapshot])
  const byDate = useMemo(
    () => groupByDate(monthEvents.filter((e) => matchesFilter(e, filter))),
    [monthEvents, filter],
  )
  const undated = useMemo(
    () => (snapshot?.undated ?? []).filter((p) => matchesFilter(p, filter)),
    [snapshot, filter],
  )

  // 고른 날이 보고 있는 달에 없으면 오늘, 오늘도 없으면 그 달 1일
  const selected =
    picked && isSameMonth(picked, month)
      ? picked
      : isSameMonth(today, month)
        ? today
        : toDateKey(month.year, month.month, 1)

  const pickDay = (day: CalendarDay) => {
    if (!day.inMonth) setMonth({ year: day.year, month: day.month })
    setPicked(day.key)
  }

  return (
    <div className="page">
      <main className="cal">
        <Header
          month={month}
          generatedAt={snapshot?.generatedAt ?? null}
          refreshing={refreshing}
          onPrev={() => setMonth((m) => addMonths(m, -1))}
          onNext={() => setMonth((m) => addMonths(m, 1))}
          onToday={() => {
            setMonth(kstYearMonth(new Date()))
            setPicked(today)
          }}
          onRefresh={refresh}
        />

        <div className="cal__filter">
          <FilterSeg value={filter} counts={counts} onChange={setFilter} />
        </div>

        {phase === 'error' && (
          <div className="notice" role="alert">
            <WarningIcon size={18} aria-hidden />
            <span>
              {error} {snapshot ? '이전에 받은 일정을 보여 줍니다.' : '새로고침 버튼으로 다시 시도해 주세요.'}
            </span>
          </div>
        )}

        <div className="cal__stage" aria-busy={phase === 'loading'}>
          <MonthGrid weeks={weeks} byDate={byDate} today={today} selected={selected} onSelect={pickDay} />
          {phase === 'loading' && (
            <div className="loading">
              <CircleNotchIcon className="spin" size={22} aria-hidden />
              게시판에서 벙을 모으는 중
            </div>
          )}
        </div>

        <UndatedList posts={undated} onOpen={setOpenEvent} />

        <DayAgenda dateKey={selected} events={byDate.get(selected) ?? NO_EVENTS} onOpen={setOpenEvent} />
      </main>

      <EventSheet event={openEvent} onClose={() => setOpenEvent(null)} />
    </div>
  )
}
