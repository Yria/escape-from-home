import { describe, expect, it, vi } from 'vitest'
import { ARTICLES_ENDPOINT, fetchArticles } from './api.ts'
import { articleStatus, buildSnapshot, groupAppLaunchUrl } from './snapshot.ts'
import { dateToSomoimTime, somoimTimeToDate } from './time.ts'
import type { SomoimArticle } from './types.ts'

const NOW = new Date('2026-09-29T12:00:00+09:00')
const DAY = 86_400

function article(i: number, ot: number, extra: Partial<SomoimArticle> = {}): SomoimArticle {
  return {
    id: `a${i}`, gid: 'g', wid: `w${i}`, wn: `작성자${i}`, at: `제목 ${i}`, c: `제목 ${i}\n\n본문`,
    w_t: ot, ot, rn: 0, lc: 0, ic: 0, cat: 'I', ...extra,
  }
}

/** 최신순 목록을 20개씩 내려주는 가짜 서버. 경계(ot == s_t)를 포함해 중복이 생기게 한다. */
function mockServer(all: SomoimArticle[], opts: { eofAt?: number; pageSize?: number; exclusive?: boolean } = {}) {
  const pageSize = opts.pageSize ?? 20
  const calls: Record<string, unknown>[] = []
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe(ARTICLES_ENDPOINT)
    expect(init?.method).toBe('POST')
    const body = JSON.parse(String(init?.body)) as { gid: string; wql: number; s_t?: number }
    calls.push(body)
    const list = body.s_t == null ? all : all.filter((a) => (opts.exclusive ? a.ot < body.s_t! : a.ot <= body.s_t!))
    const cs = list.slice(0, pageSize)
    const res: Record<string, unknown> = { res: 100, cs, s_t: cs.at(-1)?.ot ?? 0 }
    if (opts.eofAt != null && calls.length >= opts.eofAt) res.eof = 'Y'
    return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

const nowT = dateToSomoimTime(NOW)
const makeList = (n: number, stepDays = 1) => Array.from({ length: n }, (_, i) => article(i, nowT - i * stepDays * DAY))

describe('somoimTimeToDate', () => {
  it('1e9 초 오프셋', () => {
    expect(somoimTimeToDate(790650622).toISOString()).toBe('2026-09-29T02:57:02.000Z')
    expect(dateToSomoimTime(somoimTimeToDate(790650622))).toBe(790650622)
  })
})

describe('fetchArticles', () => {
  it('첫 요청은 s_t 없이, 이후 마지막 글의 ot 로 넘긴다', async () => {
    const { impl, calls } = mockServer(makeList(50))
    const out = await fetchArticles({ groupId: 'g', fetchImpl: impl, since: new Date(NOW.getTime() - 365 * DAY * 1000) })
    expect(calls[0]).toEqual({ gid: 'g', wql: 20 })
    expect(calls[1].s_t).toBe(makeList(50)[19].ot)
    expect(out.map((a) => a.id)).toEqual(makeList(50).map((a) => a.id))
  })

  it('경계 중복을 id 로 제거한다', async () => {
    const { impl } = mockServer(makeList(45))
    const out = await fetchArticles({ fetchImpl: impl, since: new Date(0) })
    expect(new Set(out.map((a) => a.id)).size).toBe(out.length)
    expect(out).toHaveLength(45)
  })

  it('since 보다 오래된 글에 닿으면 멈추고 그 글은 뺀다', async () => {
    const { impl, calls } = mockServer(makeList(200))
    const since = new Date(NOW.getTime() - 30.5 * DAY * 1000)
    const out = await fetchArticles({ fetchImpl: impl, since })
    expect(out).toHaveLength(31) // 0~30일 전
    expect(calls).toHaveLength(2)
  })

  it('기본 since 는 120일 전', async () => {
    vi.useFakeTimers({ now: NOW })
    try {
      const { impl } = mockServer(makeList(300))
      const out = await fetchArticles({ fetchImpl: impl, maxPages: 100 })
      expect(out).toHaveLength(121)
    } finally {
      vi.useRealTimers()
    }
  })

  it('eof 면 멈춘다', async () => {
    const { impl, calls } = mockServer(makeList(100), { eofAt: 2 })
    const out = await fetchArticles({ fetchImpl: impl, since: new Date(0) })
    expect(calls).toHaveLength(2)
    expect(out).toHaveLength(40 - 1) // 2쪽째 첫 글은 경계 중복
  })

  it('빈 페이지면 멈춘다', async () => {
    const { impl, calls } = mockServer(makeList(40), { exclusive: true })
    const out = await fetchArticles({ fetchImpl: impl, since: new Date(0) })
    expect(out).toHaveLength(40)
    expect(calls).toHaveLength(3) // 20 + 20 + 빈 페이지
  })

  it('커서가 줄지 않으면 무한루프 없이 멈춘다', async () => {
    const same = Array.from({ length: 30 }, (_, i) => article(i, nowT))
    const { impl, calls } = mockServer(same)
    const out = await fetchArticles({ fetchImpl: impl, since: new Date(0) })
    expect(out).toHaveLength(20)
    expect(calls).toHaveLength(2)
  })

  it('maxPages 기본 15', async () => {
    const { impl, calls } = mockServer(makeList(1000, 0.01))
    await fetchArticles({ fetchImpl: impl, since: new Date(0) })
    expect(calls).toHaveLength(15)
  })

  it('고정 공지(w_t=2e9)가 맨 앞에 있어도 ot 로 이어간다', async () => {
    const list = [article(999, nowT - 900 * DAY, { cat: 'A', w_t: 2_000_000_000 }), ...makeList(30)]
    const { impl } = mockServer(list.sort((a, b) => b.ot - a.ot))
    const out = await fetchArticles({ fetchImpl: impl, since: new Date(NOW.getTime() - 60 * DAY * 1000) })
    expect(out.find((a) => a.id === 'a999')).toBeUndefined()
    expect(out).toHaveLength(30)
  })

  it('HTTP 오류·res 코드 오류는 예외', async () => {
    const bad = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch
    await expect(fetchArticles({ fetchImpl: bad })).rejects.toThrow(/HTTP 500/)
    const wrong = (async () => new Response(JSON.stringify({ res: 200 }))) as unknown as typeof fetch
    await expect(fetchArticles({ fetchImpl: wrong })).rejects.toThrow(/res=200/)
  })
})

describe('buildSnapshot', () => {
  it('가짜 서버로 스냅샷을 만든다', async () => {
    const ot = dateToSomoimTime(new Date('2026-09-20T12:00:00+09:00'))
    const list = [
      article(1, ot, { at: '[마감] 10/3(토) 강남 벙', c: '[마감] 10/3(토) 강남 벙\n\n19:30\n3/3 가, 나, 다', cat: 'F', ic: 1 }),
      article(2, ot - 10, { at: '10월 1일 홍대', c: '10월 1일 홍대\n\n오후 2시', cat: 'I' }),
      article(3, ot - 20, { at: '공지', c: '공지\n\n10/1 정모', cat: 'A' }),
      article(4, ot - 30, { at: '가입인사', c: '가입인사\n\n안녕하세요', cat: 'J' }),
      article(5, ot - 40, { at: '잡담', c: '잡담\n\n날짜 미정', cat: 'F' }),
    ]
    const { impl } = mockServer(list)
    const snap = await buildSnapshot({ groupId: 'g', fetchImpl: impl, since: new Date(0), now: NOW })
    expect(snap.groupUrl).toBe('https://www.somoim.co.kr/g')
    expect(snap.events.map((e) => [e.id, e.date, e.startTime, e.status])).toEqual([
      ['a2', '2026-10-01', '14:00', 'open'],
      ['a1', '2026-10-03', '19:30', 'closed'],
    ])
    expect([...snap.events, ...snap.undated].map((e) => e.groupId)).toEqual(['g', 'g', 'g'])
    expect(snap.events[1]).toMatchObject({ title: '10/3(토) 강남 벙', participants: { current: 3, max: 3 }, preview: '19:30\n3/3 가, 나, 다' })
    expect(snap.undated.map((u) => u.id)).toEqual(['a5'])
  })

  it('기본으로 오늘(KST) 기준 14일 전보다 과거 일정·글은 뺀다', async () => {
    const t = (iso: string) => dateToSomoimTime(new Date(iso))
    const list = [
      // 한참 전에 올라왔지만 모임은 앞으로 → 남는다
      article(1, t('2026-09-01T12:00:00+09:00'), { at: '10/10 강남', c: '10/10 강남\n\n19:00', cat: 'I' }),
      article(2, t('2026-08-30T12:00:00+09:00'), { at: '9/15 홍대', c: '9/15 홍대\n\n14:00', cat: 'F' }), // 경계일 → 남는다
      article(3, t('2026-08-29T12:00:00+09:00'), { at: '9/14 건대', c: '9/14 건대\n\n14:00', cat: 'F' }), // 하루 넘음 → 빠진다
      article(4, t('2026-09-15T09:00:00+09:00'), { at: '잡담', c: '잡담\n\n날짜 미정', cat: 'F' }), // 게시일 경계 → 남는다
      article(5, t('2026-09-14T23:00:00+09:00'), { at: '잡담2', c: '잡담2\n\n날짜 미정', cat: 'F' }), // → 빠진다
    ]
    const { impl } = mockServer(list)
    const snap = await buildSnapshot({ groupId: 'g', fetchImpl: impl, now: NOW })
    expect(snap.events.map((e) => e.id)).toEqual(['a2', 'a1'])
    expect(snap.undated.map((u) => u.id)).toEqual(['a4'])
  })

  it('수집 하한은 기본 14 + 30 = 44일 전 게시글', async () => {
    const { impl, calls } = mockServer(makeList(100)) // 날짜 없는 I 글이 하루 간격
    const snap = await buildSnapshot({ fetchImpl: impl, now: NOW })
    expect(calls).toHaveLength(3) // 44일 전 글이 있는 3쪽에서 멈춘다
    expect(snap.undated).toHaveLength(15) // 0~14일 전
  })
})

describe('fetchArticles — 제한 시간', () => {
  /** 응답을 영원히 주지 않고, signal 이 끊기면 그 사유로 끝나는 서버 */
  const hanging = (): typeof fetch =>
    ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })) as typeof fetch

  it('멈춘 서버는 timeoutMs 뒤 한국어 오류로 끝난다 (빌드 대체 경로로 넘어가도록)', async () => {
    const impl = hanging()
    await expect(fetchArticles({ fetchImpl: impl, timeoutMs: 30 })).rejects.toThrow('소모임 게시판 응답이 0.03초 안에 오지 않았습니다.')
  })

  it('buildSnapshot 도 timeoutMs 를 넘긴다', async () => {
    const impl = hanging()
    await expect(buildSnapshot({ fetchImpl: impl, timeoutMs: 30 })).rejects.toThrow(/초 안에 오지 않았습니다/)
  })

  it('호출자가 취소하면 그 사유 그대로', async () => {
    const impl = hanging()
    const ac = new AbortController()
    const p = fetchArticles({ fetchImpl: impl, signal: ac.signal, timeoutMs: 5_000 })
    ac.abort(new Error('취소'))
    await expect(p).rejects.toThrow('취소')
  })
})

describe('articleStatus — 분류를 안 옮긴 관심사 글', () => {
  const art = (at: string, c = '', cat = 'I') => ({ at, c: `${at}\n\n${c}`, cat })
  it('관심사 글은 모집중', () => {
    expect(articleStatus(art('10/10 강남', '2/4 모집'), { date: '2026-10-10', participants: { current: 2, max: 4 }, today: '2026-09-29' })).toBe('open')
  })
  it('"마감 임박" 같은 말은 마감이 아니다', () => {
    expect(articleStatus(art('10/10 강남', '마감 임박! 한 자리 남았어요'))).toBe('open')
  })
  it('인원이 다 차면 마감', () => {
    expect(articleStatus(art('10/10 강남', '3/3 가 나 다'), { participants: { current: 3, max: 3 } })).toBe('closed')
  })
  it('모임 날짜가 지났으면 마감 (오늘은 아직 모집중)', () => {
    expect(articleStatus(art('9/28 강남'), { date: '2026-09-28', today: '2026-09-29' })).toBe('closed')
    expect(articleStatus(art('9/29 강남'), { date: '2026-09-29', today: '2026-09-29' })).toBe('open')
  })
  it('후기는 날짜가 지나도 완료', () => {
    expect(articleStatus(art('9/1 강남', '', 'E'), { date: '2026-09-01', today: '2026-09-29' })).toBe('done')
  })
})

describe('buildSnapshot — 요일이 안 맞는 글', () => {
  it('날짜 미확인으로 보내고 dateConflict 를 싣는다', async () => {
    const ot = dateToSomoimTime(new Date('2026-09-20T12:00:00+09:00'))
    const { impl } = mockServer([article(1, ot, { at: '9/30(목) 홍대 오시리스', c: '9/30(목) 홍대 오시리스\n\n19:30', cat: 'I' })])
    const snap = await buildSnapshot({ groupId: 'g', fetchImpl: impl, since: new Date(0), now: NOW })
    expect(snap.events).toHaveLength(0)
    expect(snap.undated[0].dateConflict).toEqual({ date: '2026-09-30', writtenWeekday: 4, actualWeekday: 3 })
    expect(snap.undated[0].startTime).toBe('19:30')
  })
})

describe('groupAppLaunchUrl', () => {
  it('iOS 는 somoim 스킴으로 모임 화면(type=63)을 연다', () => {
    expect(groupAppLaunchUrl('g-1', 'ios')).toBe('somoim://com.friendscube.Somoim?type=63&gid=g-1')
  })

  it('Android 는 소모임 웹과 같은 intent 주소를 쓴다', () => {
    expect(groupAppLaunchUrl('g-1', 'android')).toBe(
      'intent://com.friendscube.Somoim?type=63&gid=g-1#Intent;scheme=somoim;action=android.intent.action.VIEW;' +
        'category=android.intent.category.BROWSABLE;package=com.friendscube.somoim;end',
    )
  })
})
