import { useState } from 'react'
import type { ScheduleEvent } from '@escape-from-home/somoim'
import { DoorIcon } from '@phosphor-icons/react'
import type { CalendarDay } from '../lib/calendar'
import { shortTitle } from '../lib/event'
import { Drip } from './Drip'

const MAX_SHOWN = 3

interface Props {
  day: CalendarDay
  events: ScheduleEvent[]
  isToday: boolean
  isSelected: boolean
  onSelect: (day: CalendarDay) => void
}

/**
 * 포스터 칸: 사진 있는 벙이 하나라도 있으면 최대 3장을 세로로 나눠 깔고,
 * 사진이 하나도 없으면 제목 알약을 쌓는다. 공포 벙이 있는 날은 위에서 피가 흐른다.
 */
export function DayCell({ day, events, isToday, isSelected, onSelect }: Props) {
  const shown = events.slice(0, MAX_SHOWN)
  const withImg = events.some((e) => e.thumbnailUrl)
  const horror = events.some((e) => e.horror)
  const cls = [
    'cell',
    events.length ? 'cell--has' : '',
    events.length && events.every(isFinished) ? 'cell--finished' : '',
    day.inMonth ? '' : 'cell--outside',
    isToday ? 'cell--today' : '',
    isSelected ? 'cell--selected' : '',
    day.weekday === 0 ? 'cell--sun' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const label = `${day.month}월 ${day.day}일${isToday ? ' 오늘' : ''}${events.length ? `, 벙 ${events.length}개` : ''}`

  return (
    <button type="button" className={cls} onClick={() => onSelect(day)} aria-label={label} aria-pressed={isSelected}>
      {withImg && (
        <>
          <span className="cell__posters">
            {shown.map((e) => (
              <Poster key={e.id} src={e.thumbnailUrl} dim={isFinished(e)} />
            ))}
          </span>
          <span className="cell__shade" />
        </>
      )}
      {horror && <Drip seed={day.key} />}
      <span className="cell__num">{day.day}</span>
      {events.length > MAX_SHOWN && <span className="cell__more">+{events.length - MAX_SHOWN}</span>}
      {!withImg && events.length > 0 && (
        <span className="cell__pills">
          {shown.map((e) => (
            <span
              key={e.id}
              className={`cell__pill${e.horror ? ' cell__pill--horror' : ''}${isFinished(e) ? ' is-dim' : ''}`}
            >
              {shortTitle(e.title)}
            </span>
          ))}
        </span>
      )}
      <span className="cell__ring" />
    </button>
  )
}

/** 모집이 끝난 벙(마감·완료·펑)은 칸 안에서 흐리게 보여 모집중인 벙이 눈에 띄게 한다 */
const isFinished = (e: ScheduleEvent) => e.status !== 'open' || e.cancelled

/** 포스터 한 장. 사진이 없거나 못 불러오면 문 아이콘 */
function Poster({ src, dim }: { src: string | null; dim: boolean }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={`cell__poster${dim ? ' is-dim' : ''}`}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <DoorIcon size={12} aria-hidden />
      )}
    </span>
  )
}
