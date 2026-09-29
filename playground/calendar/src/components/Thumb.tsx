import { useState } from 'react'
import { DoorIcon } from '@phosphor-icons/react'

interface Props {
  /** 앞에서부터 시도하고 실패하면 다음 후보로 넘어간다 */
  sources: (string | null | undefined)[]
  className?: string
  alt?: string
  iconSize?: number
}

/** 게시글 사진 → 문 아이콘 순으로 대체되는 포스터 썸네일. 후보가 바뀌면 key 로 재마운트할 것. */
export function Thumb({ sources, className = '', alt = '', iconSize = 20 }: Props) {
  const list = sources.filter((s): s is string => !!s)
  const [idx, setIdx] = useState(0)
  const src = list[idx]
  return (
    <span className={`thumb ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        <DoorIcon size={iconSize} aria-hidden />
      )}
    </span>
  )
}
