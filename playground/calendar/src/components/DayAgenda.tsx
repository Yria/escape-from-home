import type { ScheduleEvent } from '@escape-from-home/somoim'
import { CaretRightIcon, ChatCircleIcon, UserIcon, UsersIcon } from '@phosphor-icons/react'
import { formatDayLong } from '../lib/calendar'
import { HorrorTag, StatusTag } from './StatusTag'
import { Thumb } from './Thumb'

interface Props {
  dateKey: string
  events: ScheduleEvent[]
  onOpen: (e: ScheduleEvent) => void
}

export function DayAgenda({ dateKey, events, onOpen }: Props) {
  return (
    <section className="agenda" aria-labelledby="agenda-title">
      <h2 id="agenda-title" className="agenda__title">
        {formatDayLong(dateKey)}
      </h2>
      {events.length === 0 ? (
        <p className="agenda__empty">이 날은 올라온 벙이 없어요.</p>
      ) : (
        events.map((e) => <EventCard key={e.id} event={e} onOpen={onOpen} />)
      )}
    </section>
  )
}

function EventCard({ event: e, onOpen }: { event: ScheduleEvent; onOpen: (e: ScheduleEvent) => void }) {
  return (
    <button type="button" className="card event-card" onClick={() => onOpen(e)}>
      <Thumb key={e.id} className="event-card__thumb" sources={[e.thumbnailUrl]} />
      <span className="event-card__body">
        <span className="event-card__top">
          {e.startTime ?? '시간 미정'}
          <StatusTag status={e.status} cancelled={e.cancelled} />
          {e.horror && <HorrorTag />}
        </span>
        <span className={`card-title event-card__title${e.cancelled ? ' is-cancelled' : ''}`}>{e.title}</span>
        <span className="meta event-card__meta">
          {e.participants && (
            <span>
              <UsersIcon aria-hidden />
              {e.participants.current}/{e.participants.max}명
            </span>
          )}
          <span>
            <ChatCircleIcon aria-hidden />
            {e.commentCount}
          </span>
          <span>
            <UserIcon aria-hidden />
            {e.author}
          </span>
        </span>
      </span>
      <CaretRightIcon className="caret-muted event-card__caret" aria-hidden />
    </button>
  )
}
