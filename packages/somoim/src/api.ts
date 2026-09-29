import { DEFAULT_GROUP_ID, type SomoimArticle } from './types.ts'
import { dateToSomoimTime } from './time.ts'

export const ARTICLES_ENDPOINT = 'https://www.somoim.co.kr/api/articles'
/** 서버가 20건으로 자른다 */
export const PAGE_SIZE = 20
export const DEFAULT_MAX_PAGES = 15
export const DEFAULT_SINCE_DAYS = 120
/** 요청 한 번(페이지 하나)의 제한 시간. 멈춘 서버 때문에 빌드·dev 서버가 무한정 기다리지 않게 한다. */
export const DEFAULT_TIMEOUT_MS = 10_000

interface ArticlesResponse {
  res: number
  cs?: SomoimArticle[]
  s_t?: number
  eof?: string
}

export interface FetchArticlesOptions {
  groupId?: string
  /** 이보다 오래된(ot 기준) 글에 닿으면 멈춘다. 기본 120일 전 */
  since?: Date
  maxPages?: number
  fetchImpl?: typeof fetch
  /** 페이지 요청 하나의 제한 시간(ms). 기본 10초 */
  timeoutMs?: number
  /** 호출자가 전체를 취소할 때 */
  signal?: AbortSignal
}

async function fetchPage(
  fetchImpl: typeof fetch,
  gid: string,
  sT: number | undefined,
  timeoutMs: number,
  outer: AbortSignal | undefined,
): Promise<ArticlesResponse> {
  const body: Record<string, unknown> = { gid, wql: PAGE_SIZE }
  if (sT != null) body.s_t = sT
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = outer ? AbortSignal.any([outer, timeout]) : timeout
  try {
    const res = await fetchImpl(ARTICLES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) throw new Error(`소모임 게시판 요청 실패: HTTP ${res.status}`)
    const json = (await res.json()) as ArticlesResponse
    if (json.res !== 100) throw new Error(`소모임 게시판 응답 오류: res=${String(json.res)}`)
    return json
  } catch (err) {
    if (timeout.aborted && !outer?.aborted) {
      throw new Error(`소모임 게시판 응답이 ${timeoutMs / 1000}초 안에 오지 않았습니다.`, { cause: err })
    }
    throw err
  }
}

/** 게시판을 최신 → 과거 순으로 페이지 넘기며 가져온다 (id 중복 제거) */
export async function fetchArticles(opts: FetchArticlesOptions = {}): Promise<SomoimArticle[]> {
  const gid = opts.groupId ?? DEFAULT_GROUP_ID
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES
  const since = opts.since ?? new Date(Date.now() - DEFAULT_SINCE_DAYS * 86_400_000)
  const sinceT = dateToSomoimTime(since)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const seen = new Set<string>()
  const out: SomoimArticle[] = []
  let sT: number | undefined
  for (let page = 0; page < maxPages; page++) {
    const json = await fetchPage(fetchImpl, gid, sT, timeoutMs, opts.signal)
    const items = json.cs ?? []
    if (items.length === 0) break
    for (const a of items) {
      if (seen.has(a.id)) continue
      seen.add(a.id)
      if (a.ot < sinceT) continue
      out.push(a)
    }
    const last = items[items.length - 1]
    if (json.eof === 'Y' || last.ot < sinceT) break
    if (sT != null && last.ot >= sT) break // 커서가 안 줄면 무한루프 방지
    sT = last.ot
  }
  return out
}
