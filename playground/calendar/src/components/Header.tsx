import { ArrowClockwiseIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { formatKstClock, formatMonthTitle, type YearMonth } from '../lib/calendar'

interface Props {
  month: YearMonth
  generatedAt: string | null
  refreshing: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onRefresh: () => void
}

export function Header({ month, generatedAt, refreshing, onPrev, onNext, onToday, onRefresh }: Props) {
  const synced = generatedAt ? `마지막 갱신 ${formatKstClock(generatedAt)}` : '게시판 다시 불러오기'
  return (
    <header className="cal-head">
      <div className="cal-head__title">
        <span className="cal-head__kicker">ESCAPE CALENDAR</span>
        <h1 aria-live="polite">{formatMonthTitle(month)}</h1>
      </div>
      <div className="cal-head__ctrl">
        <button type="button" className="btn btn-ghost cal-head__today" onClick={onToday}>
          오늘
        </button>
        <button
          type="button"
          className="btn btn-icon btn-secondary btn-bare"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="게시판 다시 불러오기"
          title={synced}
        >
          <ArrowClockwiseIcon size={18} className={refreshing ? 'spin' : undefined} />
        </button>
        <button type="button" className="btn btn-icon btn-secondary btn-bare" onClick={onPrev} aria-label="이전 달">
          <CaretLeftIcon size={18} />
        </button>
        <button type="button" className="btn btn-icon btn-secondary btn-bare" onClick={onNext} aria-label="다음 달">
          <CaretRightIcon size={18} />
        </button>
      </div>
    </header>
  )
}
