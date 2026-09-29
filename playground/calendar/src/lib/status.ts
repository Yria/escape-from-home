import type { EventStatus } from '@escape-from-home/somoim'

/** 필터 탭. 완료(후기)는 따로 탭 없이 '전체'에서만 보인다. 공포는 상태와 상관없이 공포 벙만 */
export type StatusFilter = 'all' | 'open' | 'closed' | 'horror'

export const STATUS_LABEL: Record<EventStatus, string> = {
  open: '모집중',
  closed: '마감',
  done: '완료',
}

export const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'open', label: STATUS_LABEL.open },
  { value: 'closed', label: STATUS_LABEL.closed },
  { value: 'horror', label: '공포' },
]

export const CANCELLED_LABEL = '펑'

/** 화면에 보일 상태 이름. 펑(취소)된 모임은 상태(마감)보다 '펑'을 먼저 알린다. */
export function statusLabel(item: { status: EventStatus; cancelled?: boolean }): string {
  return item.cancelled ? CANCELLED_LABEL : STATUS_LABEL[item.status]
}

/** 상태별 CSS 수식어 (ticket--*, badge--*, dot--*) */
export function statusModifier(item: { status: EventStatus; cancelled?: boolean }): string {
  return item.cancelled ? 'cancelled' : item.status
}

interface Filterable {
  status: EventStatus
  horror?: boolean
}

export function matchesFilter(item: Filterable, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'horror') return !!item.horror
  return item.status === filter
}

export function countByStatus(items: readonly Filterable[]): Record<StatusFilter, number> {
  const c: Record<StatusFilter, number> = { all: items.length, open: 0, closed: 0, horror: 0 }
  for (const i of items) {
    if (i.status !== 'done') c[i.status]++
    if (i.horror) c.horror++
  }
  return c
}
