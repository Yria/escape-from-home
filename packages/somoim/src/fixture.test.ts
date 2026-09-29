import { describe, expect, it } from 'vitest'
import articlesJson from './__fixtures__/articles.json' with { type: 'json' }
import { snapshotFromArticles, toScheduleEvent } from './snapshot.ts'
import type { SomoimArticle } from './types.ts'

const articles = articlesJson as SomoimArticle[]
const byTitle = (prefix: string) => {
  const a = articles.find((x) => x.at.startsWith(prefix))
  if (!a) throw new Error(`fixture 에 없음: ${prefix}`)
  return a
}

describe('fixture 전체 불변식', () => {
  it('140건 모두 크래시 없이 처리되고 값 형식이 맞다', () => {
    expect(articles).toHaveLength(140)
    for (const a of articles) {
      const ev = toScheduleEvent(a)
      if (!ev) continue
      expect(ev.date, a.at).toMatch(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
      expect(Number.isNaN(new Date(`${ev.date}T00:00:00+09:00`).getTime())).toBe(false)
      if (ev.startTime) expect(ev.startTime, a.at).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
      if (ev.endTime) {
        expect(ev.endTime, a.at).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
        expect(ev.startTime, a.at).not.toBeNull()
      }
      if (ev.participants) {
        expect(ev.participants.current).toBeLessThanOrEqual(ev.participants.max)
        expect(ev.participants.max).toBeGreaterThanOrEqual(2)
        expect(ev.participants.max).toBeLessThanOrEqual(30)
      }
      expect(ev.postedAt).toMatch(/\+09:00$/)
      expect(ev.title).not.toMatch(/^[\[(]\s*마감/)
      expect(ev.articleUrl).toBe('https://www.somoim.co.kr/c5d27e88-7d3c-11eb-8444-0a13280ca5bf1')
      expect(ev.thumbnailUrl == null).toBe(a.ic === 0)
      // 게시일에서 크게 벗어난 날짜가 없어야 한다 (연도 추정 확인)
      const diffDays = (new Date(`${ev.date}T00:00:00+09:00`).getTime() - new Date(ev.postedAt).getTime()) / 86_400_000
      expect(diffDays, `${a.at} → ${ev.date}`).toBeGreaterThan(-60)
      expect(diffDays, `${a.at} → ${ev.date}`).toBeLessThan(200)
    }
  })

  it('날짜 미확인 글도 언제쯤·인원·댓글을 읽어 둔다', () => {
    const snap = snapshotFromArticles(articles, { now: new Date('2026-09-29T12:00:00+09:00') })
    const by = (t: string) => snap.undated.find((u) => u.rawTitle.includes(t))!
    expect(by('싸패방')).toMatchObject({
      participants: { current: 3, max: 3 },
      members: ['동건', '미현', '무성'],
      commentCount: 3,
      horror: true,
      whenHint: null,
    })
    expect(by('마음을 그려드립니다').whenHint).toBe('금요일')
    expect(by('연애프로 살인사건')).toMatchObject({ whenHint: '주말', cancelled: true })
    expect(by('맷차카멜레온').whenHint).toBe('10월 중')
    for (const u of snap.undated) {
      expect(u.preview.length).toBeGreaterThan(0)
      expect(u.authorAvatarUrl).toMatch(/^https:/)
    }
  })

  it('공포 벙: 공테·쫄·탱이 적힌 실제 글을 공포로 본다', () => {
    const snap = snapshotFromArticles(articles, { now: new Date('2026-09-29T12:00:00+09:00') })
    const horror = new Set([...snap.events, ...snap.undated].filter((e) => e.horror).map((e) => e.rawTitle))
    expect(horror).toContain('[마감] 7/6 (월) 19:05 AYAKO (공테)')
    expect(horror).toContain('(마감)7/23(목) 홍대 플레이33 피안화')
    expect(horror).toContain('[마감] 일협 아워즈 싸패방')
    expect(horror.has('[계속모집] 강남/건대 방탈 같이 하실 분')).toBe(false)
  })

  it('스냅샷: 공지 제외, 날짜 있는 글은 events, 나머지는 undated', () => {
    const snap = snapshotFromArticles(articles, { now: new Date('2026-09-29T12:00:00+09:00') })
    expect(snap.groupName).toBe('방구석을 탈출하는 사람들')
    expect(snap.generatedAt).toBe('2026-09-29T12:00:00+09:00')
    expect(snap.groupImageUrl).toBe('https://d228e474i2d5yf.cloudfront.net/c5d27e88-7d3c-11eb-8444-0a13280ca5bf1.png')
    expect(snap.events.some((e) => e.category === 'A')).toBe(false)
    expect(snap.undated.some((e) => e.category === 'A')).toBe(false)
    expect(snap.events.length + snap.undated.length).toBe(137)
    expect(snap.undated.map((u) => u.rawTitle).sort()).toEqual(
      [
        '[마감] 일협 아워즈 싸패방',
        '비트포비아 강남 던전 [ 마음을 그려드립니다 ]',
        '혹시나 책 읽고 싶은 분?!',
        '[계속모집] 강남/건대 방탈 같이 하실 분',
        '[펑] 부평 크씬 연애프로 살인사건',
        '맷차카멜레온 온라인게임 벙',
      ].sort(),
    )
    const keys = snap.events.map((e) => `${e.date} ${e.startTime ?? '99:99'}`)
    expect([...keys].sort()).toEqual(keys)
  })
})

type Expect = {
  date: string
  start?: string | null
  end?: string | null
  status: 'open' | 'closed' | 'done'
  cancelled?: boolean
  participants?: string | null
  title?: string
}

// 원문을 직접 읽고 확인한 기대값 (제목 앞부분 → 결과)
const EXPECTED: [string, Expect][] = [
  ['(마감)10/2(금), 강남 퍼즐팩토리', { date: '2026-10-02', status: 'closed', title: '10/2(금), 강남 퍼즐팩토리 크라임씬 가실 분!' }],
  ['10월 10일 토요일 수원 메타이스케이프', { date: '2026-10-10', status: 'open' }],
  ['[마감] 10.4(일) 부평 퍼즐팩토리', { date: '2026-10-04', status: 'closed', title: '10.4(일) 부평 퍼즐팩토리 크라임씬 하실 분!' }],
  ['1ㅇ월16일 레이저아레나', { date: '2026-10-16', start: '19:00', status: 'open' }],
  ['(마감) 10.3 안산셜록', { date: '2026-10-03', start: '14:00', end: '15:00', status: 'closed' }],
  ['[마감] 9.25 7p50 출동!', { date: '2026-09-25', start: '19:50', status: 'done', participants: '3/3' }],
  ['10/10 토 플로이드호텔', { date: '2026-10-10', start: '11:45', end: '14:15', status: 'open', participants: '2/3' }],
  ['9/23(수) 홍대 카부트 18:45', { date: '2026-09-23', start: '18:45', status: 'done', participants: '2/3' }],
  ['(펑)9월 21일 월요일 수원', { date: '2026-09-21', status: 'closed', cancelled: true, title: '9월 21일 월요일 수원 방탈하실분' }],
  ['9월 24일 목요일(추석연휴) 라비린스', { date: '2026-09-24', status: 'closed', cancelled: true, title: '9월 24일 목요일(추석연휴) 라비린스 샘 가실분' }],
  ['(펑) 8.31 건대 제로월드', { date: '2026-08-31', start: null, status: 'closed', cancelled: true }],
  ['(펑) 8/22 (토) 미스터리파티', { date: '2026-08-22', status: 'closed', cancelled: true }],
  ['9/24(목) 안산 미스터리추리클럽벙', { date: '2026-09-24', start: '14:00', end: '18:00', status: 'done', cancelled: false }],
  ['플레이33 [목격자, 다이얼]', { date: '2026-08-17', start: null, status: 'done' }],
  ['[마감] 10/7(수) 크라임씬', { date: '2026-10-07', start: '19:30', status: 'closed' }],
  ['(마감)9/22(화) 괴록', { date: '2026-09-22', start: '19:50', status: 'done', participants: '4/4' }],
  ['[마감] 9/30 (수) 홍대 오시리스', { date: '2026-09-30', start: '19:20', end: '20:30', status: 'closed' }],
  ['[마감] 9/24 목 용팔도령', { date: '2026-09-24', start: '14:55', end: '16:25', status: 'done', participants: '3/3' }],
  ['[마감] 9월 26일 (토) 홍대', { date: '2026-09-26', start: '15:00', status: 'done', participants: '3/3' }],
  ['[마감] 10.28(수) 머더미스터리', { date: '2026-10-28', start: '19:30', status: 'closed' }],
  ['11월 8일 출방사 운동회!', { date: '2026-11-08', start: null, status: 'open' }],
  ['[9.21(월) 2055] 피노키오', { date: '2026-09-21', start: '20:55', status: 'done', participants: '2/3' }],
  ['[10/11/일/19시] Nine Games', { date: '2026-10-11', start: '19:00', status: 'open' }],
  ['[마감] 9월 11일 금요일 백투더씬', { date: '2026-09-11', start: null, status: 'done' }],
  ['[마감] 9/30일 범계 나비잠', { date: '2026-09-30', start: '20:15', status: 'closed', participants: '3/3' }],
  ['(마감) 9/29 건대 더메이즈', { date: '2026-09-29', start: '18:30', status: 'closed', participants: '2/4' }],
  ['[마감](9/16) 19시 제로월드', { date: '2026-09-16', start: '19:00', status: 'done' }],
  ['(마감) 9/6(일) 아야코', { date: '2026-09-06', start: '19:05', status: 'done', participants: '3/3' }],
  ['8월 31일 홍대 해피엔딩', { date: '2026-08-31', start: '19:20', status: 'done', participants: '2/3' }],
  ['[마감]비트포비아 던전스텔라', { date: '2026-09-15', start: '20:55', status: 'done', participants: '4/4' }],
  ['[마감]8월 25일 강남목욕탕', { date: '2026-08-25', start: '20:00', status: 'done', participants: '2/2' }],
  ['(마감)8/22 10:45분 갤럭시', { date: '2026-08-22', start: '10:45', status: 'done' }],
  ['(마감) 8.20/ 일협 건더메', { date: '2026-08-20', start: null, status: 'done', participants: '3/3' }],
  ['(펑) 이스케이프# 건대점 로그아웃', { date: '2026-08-17', start: '13:10', status: 'closed', cancelled: true }],
  ['8월 13일 목요일 오후 6시 40분', { date: '2026-08-13', start: '18:40', status: 'done', participants: '1/3' }],
  ['8월4일 오르골 (마감)', { date: '2026-08-04', start: '19:10', status: 'done', participants: '3/3', title: '8월4일 오르골' }],
  ['7월 27일 저녁8시 10분 로킹1', { date: '2026-07-27', start: '20:10', status: 'done', participants: '2/3' }],
  ['(마감)10/11(일) 광주 당일치기', { date: '2026-10-11', start: null, status: 'closed' }],
  ['(8/27) 스피키지 조문', { date: '2026-08-27', start: '19:25', status: 'done', participants: '4/4' }],
  ['[마감] 7/31 구름과자', { date: '2026-07-31', start: '22:05', end: '23:10', status: 'done', participants: '3/3' }],
  ['7/27 월 저녁 7시반', { date: '2026-07-27', start: '19:30', status: 'done' }],
  ['(마감)8/12(수) 토끼굴 행운만물상', { date: '2026-08-12', start: null, status: 'done', participants: null }],
  ['[마감] 8월 9-14일 일협 제주도', { date: '2026-08-09', status: 'done' }],
  ['7/26(일) 보드게임', { date: '2026-07-26', start: '14:00', status: 'done', participants: null }],
  ['7.15(수) 문신 하실분', { date: '2026-07-15', start: '19:45', status: 'done', participants: '2/3' }],
  ['[ 마감 ] 7/14( 화 ) 건대', { date: '2026-07-14', start: '19:25', status: 'done', participants: '2/2' }],
  ['[마감](7/27 월) 수박등', { date: '2026-07-27', start: '20:00', status: 'done', participants: '6/6' }],
  ['[9월5일(토)]청모', { date: '2026-09-05', start: null, status: 'done' }],
  ['[마감] 6.30(화) 평낮 머더미스터리 꼬마각시', { date: '2026-06-30', start: '13:00', end: '18:00', status: 'done', participants: '5/5' }],
  ['[펑] 6/19 (금) 홍대 파리82', { date: '2026-06-19', start: '18:40', end: '19:52', status: 'closed', cancelled: true }],
  ['(급벙마감) 6.7일 12:35', { date: '2026-06-07', start: '12:35', status: 'done', participants: '3/3' }],
  ['마감 (8월 21일, 24일)', { date: '2026-08-21', status: 'done', title: '(8월 21일, 24일) 스테이 얼라이브 인' }],
]

describe('fixture 개별 기대값', () => {
  it.each(EXPECTED)('%s', (prefix, exp) => {
    const ev = toScheduleEvent(byTitle(prefix))
    expect(ev).not.toBeNull()
    if (!ev) return
    expect(ev.date).toBe(exp.date)
    if (exp.start !== undefined) expect(ev.startTime).toBe(exp.start)
    if (exp.end !== undefined) expect(ev.endTime).toBe(exp.end)
    else if (exp.start !== undefined) expect(ev.endTime).toBeNull()
    expect(ev.status).toBe(exp.status)
    expect(ev.cancelled).toBe(exp.cancelled ?? false)
    if (exp.participants !== undefined) {
      expect(ev.participants ? `${ev.participants.current}/${ev.participants.max}` : null).toBe(exp.participants)
    }
    if (exp.title) expect(ev.title).toBe(exp.title)
  })

  it('이미지·작성자 URL', () => {
    const a = byTitle('10/10 토 플로이드호텔')
    const ev = toScheduleEvent(a)!
    expect(ev.thumbnailUrl).toBe(`https://d3vo2hyhx9t76k.cloudfront.net/${a.id}s1.png`)
    expect(ev.imageUrl).toBe(`https://d3vo2hyhx9t76k.cloudfront.net/${a.id}1.png`)
    expect(ev.authorAvatarUrl).toBe(`https://d3vo2hyhx9t76k.cloudfront.net/${a.wid}.png`)
    expect(ev.postedAt).toBe('2026-09-21T09:56:40+09:00')
    expect(ev.preview.startsWith('안녕하세요')).toBe(true)
    expect(ev.commentCount).toBe(a.rn)
    const noImg = toScheduleEvent(byTitle('10월 10일 토요일 수원'))!
    expect(noImg.thumbnailUrl).toBeNull()
    expect(noImg.imageUrl).toBeNull()
  })
})
