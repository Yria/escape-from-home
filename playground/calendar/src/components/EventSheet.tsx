import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ScheduleEvent, UndatedPost } from '@escape-from-home/somoim'
import {
  ArrowSquareOutIcon,
  CalendarBlankIcon,
  DeviceMobileIcon,
  ChatCircleIcon,
  ClockIcon,
  UsersIcon,
  XIcon,
} from '@phosphor-icons/react'
import { formatDayLabel, formatTimeRange } from '../lib/calendar'
import { HorrorTag, StatusTag } from './StatusTag'

/** 앱을 열 수 있는 기기 (iPadOS 는 Mac 으로 보이므로 터치 여부로 가린다) */
const IS_MOBILE =
  typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1))

/** 달력의 벙이나 날짜를 못 찾은 글 */
export type SheetItem = ScheduleEvent | UndatedPost

interface Props {
  event: SheetItem | null
  onClose: () => void
}

/** 아래에서 올라오는 벙 상세. 포커스 가두기·Esc 닫기는 네이티브 <dialog> 에 맡긴다. */
export function EventSheet({ event, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (event && !d.open) {
      d.showModal()
      // 닫힌(display: none) dialog 안에서는 autoFocus 가 먹지 않으므로 연 뒤 직접 옮긴다
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!event && d.open) d.close()
  }, [event])

  // 누르기와 떼기가 모두 시트 상자 밖(백드롭)일 때만 닫는다.
  // 스크롤바를 누르거나 본문에서 끌어 선택하다 밖에서 떼도 닫히지 않게 한다.
  const downOnBackdrop = useRef(false)
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="sheet-title"
      onClose={onClose}
      onPointerDown={(e) => {
        downOnBackdrop.current = outsideBox(e)
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && outsideBox(e)) onClose()
        downOnBackdrop.current = false
      }}
    >
      {event && <SheetBody key={event.id} event={event} onClose={onClose} />}
    </dialog>
  )
}

function outsideBox(e: { clientX: number; clientY: number; currentTarget: Element }): boolean {
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
}

function SheetBody({ event: e, onClose }: { event: SheetItem; onClose: () => void }) {
  const [imgOk, setImgOk] = useState(!!e.imageUrl)
  return (
    <article className="sheet__inner">
      {imgOk && e.imageUrl && (
        <div className="sheet__hero">
          <img src={e.imageUrl} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
        </div>
      )}
      <div className="sheet__heading">
        <div className="sheet__status">
          <StatusTag status={e.status} cancelled={e.cancelled} />
          {e.horror && <HorrorTag />}
          {!('date' in e) && <span className="tag tag--sm tag--closed">날짜 미확인</span>}
          <span className="sheet__raw">{e.rawTitle !== e.title ? `원제목 ${e.rawTitle}` : ''}</span>
          <button type="button" className="btn btn-icon btn-secondary" data-autofocus onClick={onClose} aria-label="닫기">
            <XIcon size={18} />
          </button>
        </div>
        <h2 id="sheet-title" className={`sheet__title${e.cancelled ? ' is-cancelled' : ''}`}>
          {e.title}
        </h2>
      </div>

      <dl className="sheet__facts">
        <Fact icon={<CalendarBlankIcon size={16} />} label="날짜" value={dateLabel(e)} />
        <Fact icon={<ClockIcon size={16} />} label="시간" value={e.startTime ? formatTimeRange(e.startTime, e.endTime) : '미확인'} />
        <Fact
          icon={<UsersIcon size={16} />}
          label="인원"
          value={e.participants ? `${e.participants.current}/${e.participants.max}명` : '미확인'}
          sub={e.members?.length ? e.members.join(' · ') : undefined}
        />
        <Fact icon={<ChatCircleIcon size={16} />} label="댓글" value={`${e.commentCount}개`} />
      </dl>

      <div className="sheet__author">
        <Avatar key={e.authorAvatarUrl} name={e.author} src={e.authorAvatarUrl} />
        <span>
          <strong>{e.author}</strong> 님이 올린 벙
        </span>
      </div>

      {e.preview && <p className="sheet__body">{e.preview}</p>}

      <div className="sheet__foot">
        <p className="sheet__note">
          게시판 미리보기는 앞부분만 보입니다. 소모임은 글 하나로 바로 가는 링크를 주지 않아서 모임 게시판으로 이동합니다.
        </p>
        {IS_MOBILE && e.appUrl ? (
          <a className="btn btn-primary sheet__cta" href={e.appUrl}>
            소모임 앱에서 열기
            <DeviceMobileIcon size={16} aria-hidden />
          </a>
        ) : (
          <a className="btn btn-primary sheet__cta" href={e.articleUrl} target="_blank" rel="noreferrer">
            소모임에서 보기
            <ArrowSquareOutIcon size={16} aria-hidden />
          </a>
        )}
      </div>
    </article>
  )
}

/** 날짜를 못 찾은 글은 '언제쯤' 단서를, 그것도 없으면 미확인 */
function dateLabel(e: SheetItem): string {
  if ('date' in e) return formatDayLabel(e.date)
  return e.whenHint ?? '미확인'
}

function Fact({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt>
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd>
        {value}
        {sub && <span className="sheet__fact-sub">{sub}</span>}
      </dd>
    </div>
  )
}

/** 작성자 사진, 없거나 못 불러오면 이름 첫 글자 */
function Avatar({ name, src }: { name: string; src: string }) {
  const [ok, setOk] = useState(true)
  return (
    <span className="avatar" aria-hidden>
      {name.slice(0, 1)}
      {ok && <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setOk(false)} />}
    </span>
  )
}
