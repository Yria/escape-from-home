import type { EventStatus } from '@escape-from-home/somoim'
import { statusLabel, statusModifier } from '../lib/status'

export function StatusTag(props: { status: EventStatus; cancelled?: boolean }) {
  return <span className={`tag tag--sm tag--${statusModifier(props)}`}>{statusLabel(props)}</span>
}

export function HorrorTag() {
  return <span className="tag tag--sm tag--horror">공포</span>
}
