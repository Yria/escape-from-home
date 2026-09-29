import { describe, expect, it } from 'vitest'
import {
  addMonths,
  buildMonthGrid,
  daysInMonth,
  formatDayLabel,
  formatDayLong,
  formatKstClock,
  formatMonthTitle,
  formatTimeRange,
  groupByDate,
  kstDateKey,
} from './calendar'

describe('buildMonthGrid', () => {
  it('2026년 10월: 목요일 시작, 일요일부터 5주', () => {
    const g = buildMonthGrid({ year: 2026, month: 10 })
    expect(g).toHaveLength(5)
    expect(g[0][0].key).toBe('2026-09-27')
    expect(g[0][0].inMonth).toBe(false)
    expect(g[0][4]).toMatchObject({ key: '2026-10-01', inMonth: true, weekday: 4 })
    expect(g[4][6].key).toBe('2026-10-31')
    expect(g.flat().filter((d) => d.inMonth)).toHaveLength(31)
  })

  it('2026년 2월은 일요일 시작 28일 → 정확히 4주', () => {
    const g = buildMonthGrid({ year: 2026, month: 2 })
    expect(g).toHaveLength(4)
    expect(g[0][0].key).toBe('2026-02-01')
    expect(g[3][6].key).toBe('2026-02-28')
  })

  it('6주가 필요한 달 (2026년 8월: 토요일 시작 31일)', () => {
    const g = buildMonthGrid({ year: 2026, month: 8 })
    expect(g).toHaveLength(6)
    expect(g[5][0].key).toBe('2026-08-30')
    expect(g[5][6].key).toBe('2026-09-05')
  })

  it('연도 경계', () => {
    const g = buildMonthGrid({ year: 2027, month: 1 })
    expect(g[0][0].key).toBe('2026-12-27')
  })
})

describe('월 이동', () => {
  it('addMonths 는 연도를 넘나든다', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(addMonths({ year: 2026, month: 10 }, -13)).toEqual({ year: 2025, month: 9 })
  })
  it('daysInMonth 윤년', () => {
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 2)).toBe(28)
  })
  it('formatMonthTitle', () => {
    expect(formatMonthTitle({ year: 2026, month: 10 })).toBe('2026년 10월')
  })
})

describe('KST 날짜 키', () => {
  it('UTC 15시 이후는 KST 다음날', () => {
    expect(kstDateKey(new Date('2026-09-30T14:59:59Z'))).toBe('2026-09-30')
    expect(kstDateKey(new Date('2026-09-30T15:00:00Z'))).toBe('2026-10-01')
  })
  it('formatKstClock', () => {
    expect(formatKstClock('2026-09-29T14:05:00+09:00')).toBe('14:05')
    expect(formatKstClock('2026-09-29T05:05:00Z')).toBe('14:05')
  })
})

describe('groupByDate', () => {
  it('날짜별로 묶고 시간순, 시간 미정은 뒤로', () => {
    const m = groupByDate([
      { id: 'a', date: '2026-10-10', startTime: null },
      { id: 'b', date: '2026-10-10', startTime: '19:50' },
      { id: 'c', date: '2026-10-03', startTime: '14:00' },
      { id: 'd', date: '2026-10-10', startTime: '11:45' },
    ])
    expect(m.get('2026-10-10')?.map((e) => e.id)).toEqual(['d', 'b', 'a'])
    expect(m.get('2026-10-03')).toHaveLength(1)
  })
})

describe('표시 형식', () => {
  it('formatDayLabel', () => {
    expect(formatDayLabel('2026-10-10')).toBe('10월 10일 (토)')
  })
  it('formatTimeRange', () => {
    expect(formatTimeRange(null, null)).toBe('시간 미정')
    expect(formatTimeRange('11:45', '14:15')).toBe('11:45 – 14:15')
    expect(formatTimeRange('19:50', null)).toBe('19:50')
  })
})

describe('formatDayLong', () => {
  it('월 일 요일', () => {
    expect(formatDayLong('2026-09-29')).toBe('9월 29일 화요일')
  })
})
