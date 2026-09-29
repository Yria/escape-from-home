import { memo } from 'react'
import { seededRandom } from '../lib/event'

/** 공포 벙 상세 맨 위를 가로지르는 핏물 띠. 글 id 로 시드를 잡아 매번 같은 모양이다. */
export const SheetDrip = memo(function SheetDrip({ seed }: { seed: string }) {
  const r = seededRandom(seed)
  const drops = Array.from({ length: 11 }, (_, i) => {
    const cx = 10 + i * 20 + (r() - 0.5) * 8
    const w = 2.4 + r() * 2.6
    const L = 8 + r() * 26
    const dur = 4 + r() * 4
    const delay = -r() * dur
    return { cx, w, L, dur, delay }
  })
  // 가장자리 물결: 20 간격으로 오르내린다
  const wave = Array.from({ length: 11 }, (_, i) => `Q${i * 20 + 10} ${6 + r() * 4} ${(i + 1) * 20} ${4 + r() * 2}`).join(' ')
  return (
    <svg className="sheet-drip" viewBox="0 0 220 48" preserveAspectRatio="none" aria-hidden>
      <path d={`M0 0 L0 5 ${wave} L220 0 Z`} />
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
