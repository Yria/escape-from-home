import { useState } from 'react'
import type { UndatedPost } from '@escape-from-home/somoim'
import { CalendarDotsIcon, CalendarXIcon, CaretDownIcon, CaretRightIcon, CaretUpIcon, ChatCircleIcon, UserIcon } from '@phosphor-icons/react'
import { StatusTag } from './StatusTag'

interface Props {
  posts: UndatedPost[]
  onOpen: (p: UndatedPost) => void
}

export function UndatedList({ posts, onOpen }: Props) {
  const [open, setOpen] = useState(false)
  if (posts.length === 0) return null
  const Caret = open ? CaretUpIcon : CaretDownIcon
  return (
    <section className="undated" aria-label="날짜 미확인">
      <button type="button" className="undated__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <CalendarXIcon size={18} className="undated__icon" aria-hidden />
        <span className="undated__head">
          <span className="undated__title">
            날짜를 확인하지 못한 벙 <span className="undated__n">{posts.length}</span>
          </span>
          <span className="undated__hint">글에서 일정을 읽지 못해 캘린더에 표시되지 않았어요</span>
        </span>
        <Caret size={16} className="undated__caret" aria-hidden />
      </button>
      {open && (
        <ul className="undated__list">
          {posts.map((p) => (
            <li key={p.id}>
              <button type="button" className="undated__row" onClick={() => onOpen(p)}>
                <StatusTag status={p.status} cancelled={p.cancelled} />
                <span className="undated__body">
                  <span className="undated__raw">{p.rawTitle}</span>
                  <span className="meta">
                    <span>
                      <UserIcon aria-hidden />
                      {p.author}
                    </span>
                    <span>
                      <ChatCircleIcon aria-hidden />
                      {p.commentCount}
                    </span>
                    {p.whenHint && (
                      <span>
                        <CalendarDotsIcon aria-hidden />
                        {p.whenHint}
                      </span>
                    )}
                  </span>
                </span>
                <CaretRightIcon className="caret-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
