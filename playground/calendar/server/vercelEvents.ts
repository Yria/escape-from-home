// Vercel 함수 본체: 요청마다 소모임 게시판을 새로 수집해 돌려준다.
// scripts/vercel-output.ts 가 이 파일을 somoim 패키지까지 한 파일로 묶어 .vercel/output/functions/api/events.func 에 넣는다.
// 소모임 API 에 CORS 가 없어 브라우저가 직접 부를 수 없으므로 이 함수가 대신 수집한다.
import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { buildSnapshot, type ScheduleSnapshot } from '@escape-from-home/somoim'

/** 빌드 때 함수 옆에 넣어 두는 대체본 (수집도 실패하고 직전 결과도 없을 때) */
export const FALLBACK_FILE = 'events.fallback.json'

// 페이지 하나 4초, 전체 8초. 소모임이 느려도 오래 매달리지 않고 대체본으로 넘어간다.
const PAGE_TIMEOUT_MS = 4_000
const TOTAL_TIMEOUT_MS = 8_000

// 같은 인스턴스가 살아 있는 동안만 유지된다 (동시 요청 공유, 실패 시 직전 결과)
let inflight: Promise<ScheduleSnapshot> | null = null
let last: ScheduleSnapshot | null = null

function send(res: ServerResponse, body: string, status = 200, fallback?: 'last' | 'file') {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  if (fallback) res.setHeader('X-Somoim-Fallback', fallback)
  res.end(body)
}

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    inflight ??= buildSnapshot({ timeoutMs: PAGE_TIMEOUT_MS, signal: AbortSignal.timeout(TOTAL_TIMEOUT_MS) }).finally(() => {
      inflight = null
    })
    last = await inflight
    send(res, JSON.stringify(last))
  } catch (err) {
    console.warn(`[somoim] 라이브 수집 실패: ${String(err)}`)
    if (last) return send(res, JSON.stringify(last), 200, 'last')
    const file = fileURLToPath(new URL(`./${FALLBACK_FILE}`, import.meta.url))
    if (existsSync(file)) return send(res, readFileSync(file, 'utf8'), 200, 'file')
    send(res, JSON.stringify({ error: '소모임 게시판을 불러오지 못했습니다.' }), 502)
  }
}
