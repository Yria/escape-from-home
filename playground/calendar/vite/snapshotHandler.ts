import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ScheduleSnapshot } from '@escape-from-home/somoim'

export const DATA_PATH = 'data/events.json'

export interface SnapshotHandlerOptions {
  /** 호출할 때마다 게시판을 새로 긁는다 */
  collect: () => Promise<ScheduleSnapshot>
  /** 수집도 실패하고 직전 결과도 없을 때 내려줄 JSON 파일 */
  fallbackPath: string
  warn?: (msg: string) => void
}

/**
 * GET …/data/events.json 을 받을 때마다 소모임 게시판을 새로 수집해 돌려준다 (캐시 없음).
 * 동시에 들어온 요청은 진행 중인 수집 하나를 같이 기다린다.
 * 수집이 실패하면 직전 성공 결과 → fallbackPath 순으로 대체하고 X-Somoim-Fallback 헤더로 알린다.
 */
export function createSnapshotHandler(opts: SnapshotHandlerOptions) {
  let inflight: Promise<ScheduleSnapshot> | null = null
  let last: ScheduleSnapshot | null = null

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method !== 'GET' || !url.pathname.endsWith(`/${DATA_PATH}`)) return next()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    try {
      inflight ??= opts.collect().finally(() => {
        inflight = null
      })
      last = await inflight
      res.end(JSON.stringify(last))
    } catch (err) {
      opts.warn?.(`[somoim] 라이브 수집 실패: ${String(err)}`)
      if (last) {
        res.setHeader('X-Somoim-Fallback', 'last')
        res.end(JSON.stringify(last))
        return
      }
      if (existsSync(opts.fallbackPath)) {
        res.setHeader('X-Somoim-Fallback', 'file')
        res.end(readFileSync(opts.fallbackPath, 'utf8'))
        return
      }
      res.statusCode = 502
      res.end(JSON.stringify({ error: '소모임 게시판을 불러오지 못했습니다.' }))
    }
  }
}
