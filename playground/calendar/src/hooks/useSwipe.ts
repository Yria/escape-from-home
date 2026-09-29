import { useRef, type PointerEvent, type MouseEvent } from 'react'

const MIN_DISTANCE = 50
/** 가로 이동이 세로 이동보다 이만큼 커야 스와이프로 본다 (세로 스크롤과 구분) */
const DIRECTION_RATIO = 1.5

interface Handlers {
  onPointerDown: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
  onPointerCancel: () => void
  onClickCapture: (e: MouseEvent) => void
}

/** 좌우 스와이프를 감지한다. 왼쪽으로 밀면 onNext, 오른쪽으로 밀면 onPrev. */
export function useSwipe(onPrev: () => void, onNext: () => void): Handlers {
  const start = useRef<{ x: number; y: number } | null>(null)
  // 스와이프 직후 따라오는 click 이 날짜 선택으로 이어지지 않게 막는다
  const swiped = useRef(false)

  return {
    onPointerDown: (e) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
      start.current = { x: e.clientX, y: e.clientY }
      swiped.current = false
    },
    onPointerUp: (e) => {
      const s = start.current
      start.current = null
      if (!s) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * DIRECTION_RATIO) return
      swiped.current = true
      if (dx < 0) onNext()
      else onPrev()
    },
    onPointerCancel: () => {
      start.current = null
    },
    onClickCapture: (e) => {
      if (!swiped.current) return
      swiped.current = false
      e.preventDefault()
      e.stopPropagation()
    },
  }
}
