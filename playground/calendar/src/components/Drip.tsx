import { memo } from 'react'
import { seededRandom } from '../lib/event'

/** 공포 벙이 있는 날 칸 위쪽에서 피가 흘러내리는 장식. 날짜 키로 시드를 잡아 칸마다 모양이 다르고 매번 같다. */
export const Drip = memo(function Drip({ seed }: { seed: string }) {
  const r = seededRandom(seed)
  const drops = [9, 23, 37, 51].map((cx) => {
    const w = 2.2 + r() * 1.6
    const L = 10 + r() * 22
    const dur = 4 + r() * 3
    const delay = -r() * dur
    return { cx, w, L, dur, delay }
  })
  return (
    <svg className="drip" viewBox="0 0 60 60" preserveAspectRatio="none" aria-hidden>
      <path d="M0 0 H60 V5 Q55 8 50 6 Q45 4 40 7 Q35 9 30 6 Q25 4 20 7 Q15 9 10 6 Q5 4 0 7 Z" />
      {drops.map(({ cx, w, L, dur, delay }) => (
        <g key={cx}>
          <path
            className="drip__stem"
            d={`M${cx - w / 2} 4 V${L} A${w / 2} ${w / 2} 0 0 0 ${cx + w / 2} ${L} V4 Z`}
            style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
          />
          <circle
            className="drip__drop"
            cx={cx}
            cy={L + w}
            r={w / 2}
            style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
          />
        </g>
      ))}
    </svg>
  )
})
