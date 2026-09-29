import { describe, expect, it } from 'vitest'
import { countByStatus, matchesFilter, statusLabel, statusModifier } from './status'

describe('상태 필터', () => {
  it('전체는 모두 통과', () => {
    expect(matchesFilter({ status: 'done' }, 'all')).toBe(true)
    expect(matchesFilter({ status: 'open' }, 'closed')).toBe(false)
    expect(matchesFilter({ status: 'done' }, 'closed')).toBe(false)
  })
  it('공포는 상태와 상관없이 공포 벙만', () => {
    expect(matchesFilter({ status: 'done', horror: true }, 'horror')).toBe(true)
    expect(matchesFilter({ status: 'open', horror: true }, 'horror')).toBe(true)
    expect(matchesFilter({ status: 'open', horror: false }, 'horror')).toBe(false)
    // horror 필드가 없는 예전 스냅샷
    expect(matchesFilter({ status: 'open' }, 'horror')).toBe(false)
  })
  it('펑(취소)은 상태보다 먼저 보인다', () => {
    expect(statusLabel({ status: 'closed', cancelled: true })).toBe('펑')
    expect(statusModifier({ status: 'closed', cancelled: true })).toBe('cancelled')
    expect(statusLabel({ status: 'done', cancelled: false })).toBe('완료')
    // 예전 스냅샷(cancelled 필드 없음)도 그대로 동작
    expect(statusModifier({ status: 'open' })).toBe('open')
  })
  it('countByStatus', () => {
    expect(countByStatus([{ status: 'open' }, { status: 'open', horror: true }, { status: 'done', horror: true }])).toEqual({
      all: 3,
      open: 2,
      closed: 0,
      horror: 2,
    })
  })
})
