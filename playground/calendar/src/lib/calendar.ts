// 달력 계산. 모든 날짜는 KST 기준 'YYYY-MM-DD' 문자열 키로 다룬다(로컬 타임존 무관).

export interface YearMonth {
  year: number
  /** 1–12 */
  month: number
}

export interface CalendarDay {
  key: string
  year: number
  month: number
  day: number
  /** 0=일 … 6=토 */
  weekday: number
  inMonth: boolean
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map(Number)
  return { year: y, month: m, day: d }
}

/** 순간(Date)을 KST 달력 날짜 키로 */
export function kstDateKey(date: Date): string {
  const k = new Date(date.getTime() + KST_OFFSET_MS)
  return toDateKey(k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate())
}

export function kstYearMonth(date: Date): YearMonth {
  const { year, month } = parseDateKey(kstDateKey(date))
  return { year, month }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const idx = ym.year * 12 + (ym.month - 1) + delta
  return { year: Math.floor(idx / 12), month: (((idx % 12) + 12) % 12) + 1 }
}

export function monthKey(ym: YearMonth): string {
  return `${ym.year}-${pad(ym.month)}`
}

export function formatMonthTitle(ym: YearMonth): string {
  return `${ym.year}년 ${ym.month}월`
}

/** 일요일 시작 월 그리드. 앞뒤 달 날짜로 주 단위를 채운다(4–6주). */
export function buildMonthGrid(ym: YearMonth): CalendarDay[][] {
  const first = new Date(Date.UTC(ym.year, ym.month - 1, 1))
  const lead = first.getUTCDay()
  const total = lead + daysInMonth(ym.year, ym.month)
  const weeks = Math.ceil(total / 7)
  const rows: CalendarDay[][] = []
  for (let w = 0; w < weeks; w++) {
    const row: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(ym.year, ym.month - 1, 1 - lead + w * 7 + i))
      const year = d.getUTCFullYear()
      const month = d.getUTCMonth() + 1
      const day = d.getUTCDate()
      row.push({
        key: toDateKey(year, month, day),
        year,
        month,
        day,
        weekday: i,
        inMonth: year === ym.year && month === ym.month,
      })
    }
    rows.push(row)
  }
  return rows
}

interface Sortable {
  date: string
  startTime: string | null
}

/** 날짜 키별로 묶고 각 날은 시작 시간 순(시간 미정은 뒤). */
export function groupByDate<T extends Sortable>(events: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const e of events) {
    const list = map.get(e.date)
    if (list) list.push(e)
    else map.set(e.date, [e])
  }
  for (const list of map.values()) list.sort(compareByTime)
  return map
}

export function compareByTime(a: Sortable, b: Sortable): number {
  if (a.startTime === b.startTime) return 0
  if (a.startTime === null) return 1
  if (b.startTime === null) return -1
  return a.startTime < b.startTime ? -1 : 1
}

/** '2026-10-10' → '10월 10일 (토)' */
export function formatDayLabel(key: string): string {
  const { year, month, day } = parseDateKey(key)
  const wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${month}월 ${day}일 (${WEEKDAY_LABELS[wd]})`
}

/** '2026-10-10' → '10월 10일 토요일' */
export function formatDayLong(key: string): string {
  const { year, month, day } = parseDateKey(key)
  const wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${month}월 ${day}일 ${WEEKDAY_LABELS[wd]}요일`
}

export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return '시간 미정'
  return end ? `${start} – ${end}` : start
}

/** ISO 시각 → KST 'HH:mm' */
export function formatKstClock(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const k = new Date(t + KST_OFFSET_MS)
  return `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
}

/** 날짜 키가 해당 달에 속하는지 */
export function isSameMonth(key: string, ym: YearMonth): boolean {
  const { year, month } = parseDateKey(key)
  return year === ym.year && month === ym.month
}

/** 요일이 안 맞는 날짜: '2026-09-30' + 적힌 목(4) → '9월 30일 (목)?' */
export function formatConflictDate(key: string, writtenWeekday: number): string {
  const { month, day } = parseDateKey(key)
  return `${month}월 ${day}일 (${WEEKDAY_LABELS[writtenWeekday]})?`
}

/** '9월 30일은 수요일이라 …' */
export function conflictNote(key: string, actualWeekday: number): string {
  const { month, day } = parseDateKey(key)
  return `${month}월 ${day}일은 ${WEEKDAY_LABELS[actualWeekday]}요일이라 날짜·요일 중 하나가 틀렸어요`
}
