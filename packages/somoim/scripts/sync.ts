// 사용법: node packages/somoim/scripts/sync.ts [출력파일]
// 기본 출력: playground/calendar/public/data/events.json
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeSnapshot } from '../src/node.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const out = path.resolve(process.argv[2] ?? path.join(repoRoot, 'playground/calendar/public/data/events.json'))

try {
  const snap = await writeSnapshot(out)
  const dated = snap.events.length
  const range = dated ? `${snap.events[0].date} ~ ${snap.events[dated - 1].date}` : '-'
  console.log(`[somoim] 일정 ${dated}건 (${range}), 날짜 미확인 ${snap.undated.length}건 → ${out}`)
} catch (err) {
  console.error('[somoim] 수집 실패:', err instanceof Error ? err.message : err)
  process.exitCode = 1
}
