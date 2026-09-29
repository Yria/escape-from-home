import type { DateConflict, HorrorRoles, ParsedSchedule, Participants } from './types.ts'
import { addDays, daysInMonth, formatHm, formatYmd, kstParts, weekdayOf, dayDiff } from './time.ts'

/*
 * 소모임 벙 글(제목 + 본문 앞부분)에서 날짜·시간·인원을 뽑는다.
 * 본문은 ~120자로 잘려 오므로 제목의 날짜를 우선하고, 없으면 본문의 첫 날짜를 쓴다.
 */

const WEEKDAYS = '일월화수목금토'
const WD = `[${WEEKDAYS}]`

type Strength = 'strong' | 'weak'

interface DateCandidate {
  start: number
  end: number
  month: number
  day: number
  year: number | null
  weekday: number | null
  strength: Strength
  inParens: boolean
  /** 뒤에 이름 같은 짧은 한글 단어가 둘 이상 (인원 표기일 수도, 장소일 수도 있음) */
  namesAfter: boolean
}

/** 오타·전각 문자 정리. 길이를 유지해야 위치 계산이 맞는다 (1:1 치환만) */
export function normalizeText(text: string): string {
  return text
    .replace(/(\d)ㅇ(?=\s*월)/g, '$10') // "1ㅇ월" → "10월"
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[～〜]/g, '~')
    .replace(/：/g, ':')
    .replace(/／/g, '/')
    .replace(/ /g, ' ')
}

/** 날짜 뒤에 붙은 요일 힌트: "(토)", " 토", "토요일", "/일/", "화)" */
const WEEKDAY_AFTER = new RegExp(
  `^[ \\t.,]*(?:\\(\\s*(${WD})(?:요일)?\\s*\\)|\\/(${WD})(?:요일)?(?=[\\/\\s\\])]|$)|(${WD})요일|(${WD})(?=[\\s,.)\\]~\\/!:]|$))`,
)
/** 날짜 앞에 붙은 요일 힌트: "(목) 7/30", "(수요일) 8/19" */
const WEEKDAY_BEFORE = new RegExp(`\\(\\s*(${WD})(?:요일)?\\s*\\)\\s*$`)

function weekdayAfter(text: string, pos: number): { weekday: number; end: number } | null {
  const m = WEEKDAY_AFTER.exec(text.slice(pos, pos + 16))
  if (!m) return null
  const ch = m[1] ?? m[2] ?? m[3] ?? m[4]
  return { weekday: WEEKDAYS.indexOf(ch), end: pos + m[0].length }
}

function weekdayBefore(text: string, pos: number): number | null {
  const m = WEEKDAY_BEFORE.exec(text.slice(Math.max(0, pos - 10), pos))
  return m ? WEEKDAYS.indexOf(m[1]) : null
}

function isInParens(text: string, start: number, end: number): boolean {
  const before = text.slice(0, start).replace(/[ \t]+$/, '')
  const after = text.slice(end).replace(/^[ \t]+/, '')
  return before.endsWith('(') && after.startsWith(')')
}

function validMonthDay(month: number, day: number, year: number | null): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  return day <= daysInMonth(year ?? 2024, month) // 연도 미상이면 윤년 기준
}

const DATE_LABEL_BEFORE = /(날짜|일시|일정|언제)\s*(?:및\s*시간\s*)?[:：]?\s*$/
const HEADCOUNT_BEFORE = /(인원|멤버|현재|참여|모집|구해요|구함|쫄)\s*[:(]?\s*$/
const HEADCOUNT_AFTER = /^\s*[:)]?\s*(?:모집|구해요|구함|명|인(?![가-힣]))/
/** "2/3 미현, 성희", "3/3 동건 미현 무성": 뒤에 짧은 이름이 둘 이상 이어진다 */
const NAMES_AFTER = /^[ \t]*[:)]?[ \t]*[가-힣]{2,3}(?:[ \t]*[,，/][ \t]*|[ \t]+)[가-힣]{2,3}(?![가-힣])/

/** N/M 이 날짜가 아니라 인원 표기로 보이는지: "현재 4/6", "쫄 구해요 3/4", "3/4 모집중" */
function looksLikeHeadcount(text: string, start: number, end: number): boolean {
  return HEADCOUNT_BEFORE.test(text.slice(Math.max(0, start - 8), start)) || HEADCOUNT_AFTER.test(text.slice(end))
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

/** 텍스트 전체에서 날짜 후보를 찾는다 (겹치면 연도형 > 한글형 > 숫자형 순으로 우선) */
export function findDateCandidates(text: string): DateCandidate[] {
  const out: DateCandidate[] = []
  const push = (c: DateCandidate) => {
    if (out.some((o) => overlaps(o, c))) return
    out.push(c)
  }

  // 1) 연도 포함: 2026.10.4 / 2026년 10월 4일 / 26/10/4
  const yearRes = [
    /(?<!\d)(20\d{2})\s*[.\/\-년]\s*(\d{1,2})\s*[.\/\-월]\s*(\d{1,2})(?!\d)(\s*일)?/g,
    /(?<![\d.\/])([2-3]\d)([.\/])(\d{1,2})\2(\d{1,2})(?![\d.\/:])/g,
  ]
  for (const [i, re] of yearRes.entries()) {
    for (const m of text.matchAll(re)) {
      const year = i === 0 ? Number(m[1]) : 2000 + Number(m[1])
      const month = Number(i === 0 ? m[2] : m[3])
      const day = Number(i === 0 ? m[3] : m[4])
      if (!validMonthDay(month, day, year)) continue
      const start = m.index
      let end = start + m[0].length
      const wa = weekdayAfter(text, end)
      if (wa) end = wa.end
      push({ start, end, month, day, year, weekday: wa?.weekday ?? weekdayBefore(text, start), strength: 'strong', inParens: false, namesAfter: false })
    }
  }

  // 2) 한글: 10월 10일 / 10월10일 / 11월29(일) / 8월 9-14일
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})(?!\d)(\s*일)?/g)) {
    const month = Number(m[1])
    const day = Number(m[2])
    if (!validMonthDay(month, day, null)) continue
    const start = m.index
    let end = start + m[0].length
    const wa = weekdayAfter(text, end)
    if (wa) end = wa.end
    push({ start, end, month, day, year: null, weekday: wa?.weekday ?? weekdayBefore(text, start), strength: 'strong', inParens: false, namesAfter: false })
  }

  // 3) 숫자: 10/10, 10.4, 8. 27, 9/30일
  const numRe = /(?<![\d.:\/A-Za-z~])(\d{1,2})(?:(\/)(\d{1,2})|(\.)[ \t]?(\d{1,2}))(?![\d:])/g
  for (const m of text.matchAll(numRe)) {
    const month = Number(m[1])
    const slash = m[2] === '/'
    const day = Number(slash ? m[3] : m[5])
    if (!validMonthDay(month, day, null)) continue
    const start = m.index
    let end = start + m[0].length
    const rest = text.slice(end)
    // 단위가 붙으면 날짜가 아니다: 4.5점, 2.5시간, 3/3명
    if (/^[시분점배%만천원명인개방k]/.test(rest)) continue
    // "10/10~10/11" 은 날짜 범위, "3/2~3" 은 인원 범위
    const dateRange = /^\s*~\s*\d{1,2}[\/.]\d{1,2}(?!\d)/.test(rest)
    if (slash && !dateRange && /^\s*~\s*\d/.test(rest)) continue
    // 1/2/3 같은 연속 분수
    if (/^[.\/]\d/.test(rest)) continue
    let daySuffix = false
    if (rest.startsWith('일')) {
      daySuffix = true
      end += 1
    }
    const wa = weekdayAfter(text, end)
    if (wa) end = wa.end
    const weekday = wa?.weekday ?? weekdayBefore(text, start)
    const before = text.slice(Math.max(0, start - 8), start)
    // "8/11,12" 처럼 날짜를 나열하면 인원 비율이 아니다
    const listed = /^\s*,\s*\d{1,2}(?!\d)/.test(rest)
    // "날짜: 10/10", "일시 10/10" 처럼 날짜 라벨이 앞에 있으면 날짜다
    const labeled = DATE_LABEL_BEFORE.test(before)
    const ratioLike = slash && month <= day && day <= 12 && !listed && !dateRange && !labeled
    const strength: Strength = weekday != null || daySuffix || !ratioLike ? 'strong' : 'weak'
    const inParens = isInParens(text, start, start + m[0].length)
    if (ratioLike && weekday == null && looksLikeHeadcount(text, start, start + m[0].length)) continue
    const namesAfter = NAMES_AFTER.test(text.slice(start + m[0].length))
    push({ start, end, month, day, year: null, weekday, strength, inParens, namesAfter })
  }

  return out.sort((a, b) => a.start - b.start)
}

function titleEnd(text: string): number {
  const i = text.indexOf('\n')
  return i < 0 ? text.length : i
}

/**
 * 실제로 일정 날짜로 쓸 후보: 제목의 강한 후보 → 제목의 약한 후보(괄호 밖) → 본문의 강한 후보
 * → 강한 후보가 하나도 없을 때만 본문의 약한 후보(괄호 밖). 인원처럼 보이는 N/M 은 이미 걸러져 있다.
 */
function selectDate(text: string, cands: DateCandidate[]): DateCandidate | null {
  const tEnd = titleEnd(text)
  const inTitle = cands.filter((c) => c.start < tEnd)
  const strongTitle = inTitle.find((c) => c.strength === 'strong')
  if (strongTitle) return strongTitle
  const weakTitle = inTitle.find((c) => c.strength === 'weak' && !c.inParens)
  if (weakTitle) return weakTitle
  const body = cands.filter((c) => c.start >= tEnd)
  const strongBody = body.find((c) => c.strength === 'strong')
  if (strongBody) return strongBody
  return body.find((c) => !c.inParens && !c.namesAfter) ?? null
}

type YMD = { year: number; month: number; day: number }

function inferYear(month: number, day: number, weekday: number | null, posted: YMD): number | null {
  let year = posted.year
  if (validMonthDay(month, day, year) && dayDiff({ year, month, day }, posted) < -60) year += 1
  if (!validMonthDay(month, day, year)) {
    // 2/29 가 없는 해
    if (validMonthDay(month, day, year + 1)) year += 1
    else return null
  }
  if (weekday != null && weekdayOf(year, month, day) !== weekday) {
    // 요일이 다른 해와 맞아도 그럴듯한 범위(게시일 -180일 ~ +300일) 안일 때만 옮긴다.
    // 뒤늦은 후기(몇 달 전 일정)는 살리되, 요일 오타 하나로 일정이 1년 가까이 과거로 가면 안 된다.
    for (const y of [year - 1, year + 1]) {
      if (!validMonthDay(month, day, y) || weekdayOf(y, month, day) !== weekday) continue
      const diff = dayDiff({ year: y, month, day }, posted)
      if (diff >= WEEKDAY_MAX_DAYS_BEHIND && diff <= MAX_DAYS_AHEAD) return y
    }
  }
  return year
}

/** 요일에 맞춰 연도를 옮길 때 허용하는 과거 한계 (일) */
const WEEKDAY_MAX_DAYS_BEHIND = -180
/** 연도를 옮겨도 이보다 먼 미래로는 보내지 않는다 */
const MAX_DAYS_AHEAD = 300
/** 약한 후보(요일·월/일 표시 없는 N/M)는 이보다 먼 미래면 날짜로 보지 않는다 */
const WEAK_MAX_DAYS_AHEAD = 90

/** 상대 날짜: 이번주·다음주 X요일, 그리고 (제목에서만) 오늘 / 내일 / 모레 */
function relativeDate(title: string, posted: YMD & { weekday: number }, allowDayWords: boolean): YMD | null {
  const wk = /(이번\s?주|담주|다음\s?주)\s*(?:의\s*)?([일월화수목금토])요일/.exec(title)
  if (wk) {
    const target = WEEKDAYS.indexOf(wk[2])
    // 주는 월요일 시작으로 본다 (일요일은 그 주의 마지막)
    const toMonIdx = (w: number) => (w + 6) % 7
    let diff = toMonIdx(target) - toMonIdx(posted.weekday)
    if (!wk[1].startsWith('이번')) diff += 7
    if (diff < 0) diff += 7
    return addDays(posted, diff)
  }
  if (!allowDayWords) return null
  if (/(?<![가-힣])오늘/.test(title)) return posted
  if (/(?<![가-힣])내일/.test(title)) return addDays(posted, 1)
  if (/(?<![가-힣])모레/.test(title)) return addDays(posted, 2)
  return null
}

// ---- 시간 ----

interface TimeToken {
  start: number
  end: number
  hour: number
  minute: number
  /** 한 자리 시(1~9)라서 오후 추정 대상인지 */
  bareHour: boolean
  marker: 'am' | 'pm' | null
  /** "7시 이후로" 처럼 하한일 뿐인 시각 */
  lowerBound: boolean
}

const TIME_RES: { re: RegExp; read: (m: RegExpMatchArray) => { h: string; min: string; marker: 'am' | 'pm' | null } }[] = [
  // 19:50, 10:45분, 7:30pm
  {
    re: /(?<![\d.:\/])(\d{1,2})\s?:\s?([0-5]\d)(?!\d)(?:\s?([ap])\.?m\.?(?![a-z]))?/gi,
    read: (m) => ({ h: m[1], min: m[2], marker: m[3] ? (m[3].toLowerCase() === 'a' ? 'am' : 'pm') : null }),
  },
  // 19시 50분, 7시반, 20시00, 14시
  {
    re: /(?<![\d.])(\d{1,2})\s*시(?!간)(?:\s*(\d{1,2})\s*분|\s*(반)|(\d{2})(?!\d))?/g,
    read: (m) => ({ h: m[1], min: m[3] ? '30' : (m[2] ?? m[4] ?? '0'), marker: null }),
  },
  // 7p50, 7pm, 11am
  {
    re: /(?<![A-Za-z\d.:])(\d{1,2})\s?([ap])(?:\.?m\.?)?\s?([0-5]\d)?(?![A-Za-z\d])/gi,
    read: (m) => ({ h: m[1], min: m[3] ?? '0', marker: m[2].toLowerCase() === 'a' ? 'am' : 'pm' }),
  },
  // 1400-1500, 1145, 2055]
  {
    re: /(?<![\d.,:\/])([01]\d|2[0-3])([0-5]\d)(?![\d.,:\/A-Za-z가-힣])/g,
    read: (m) => ({ h: m[1], min: m[2], marker: null }),
  },
  // "19 45분"
  {
    re: /(?<![\d.:])(\d{1,2})[ \t]+([0-5]\d)\s*분/g,
    read: (m) => ({ h: m[1], min: m[2], marker: null }),
  },
]

function meridiemBefore(text: string, pos: number): 'am' | 'pm' | null {
  const before = text.slice(Math.max(0, pos - 6), pos).replace(/\s+$/, '')
  if (/(오후|저녁|밤|pm|PM)$/.test(before)) return 'pm'
  if (/(오전|아침|새벽|am|AM)$/.test(before)) return 'am'
  return null
}

function findTimeTokens(text: string, masks: { start: number; end: number }[]): TimeToken[] {
  const raw: TimeToken[] = []
  for (const { re, read } of TIME_RES) {
    for (const m of text.matchAll(re)) {
      const start = m.index
      const end = start + m[0].length
      if (masks.some((k) => overlaps(k, { start, end }))) continue
      const r = read(m)
      const hour = Number(r.h)
      const minute = Number(r.min)
      if (hour > 24 || minute > 59) continue
      const rest = text.slice(end)
      // "오전 10시에 예약이 열린다" 같은 예약 오픈 시각은 일정 시각이 아니다
      if (/^\s*(?:에|부터)\s*(?:예약|오픈|티켓)/.test(rest)) continue
      // 본문이 ~120자에서 잘려 "14시3" 처럼 분이 끊기면 정확한 시각을 알 수 없다
      if (/^\d\s*$/.test(rest)) continue
      raw.push({
        start,
        end,
        hour,
        minute,
        bareHour: r.h.length === 1 && hour >= 1 && hour <= 9,
        marker: r.marker ?? meridiemBefore(text, start),
        lowerBound: /^\s*(?:이후|넘어서|넘어|지나서)/.test(rest),
      })
    }
  }
  // 겹치면 먼저 시작하고 긴 것을 남긴다
  raw.sort((a, b) => a.start - b.start || b.end - a.end)
  const out: TimeToken[] = []
  for (const t of raw) {
    if (out.some((o) => overlaps(o, t))) continue
    out.push(t)
  }
  return out
}

function resolveHour(t: TimeToken, inheritPm = false): number | null {
  let h = t.hour
  const marker = t.marker ?? (inheritPm ? 'pm' : null)
  if (marker === 'pm') {
    if (h < 12) h += 12
  } else if (marker === 'am') {
    if (h === 12) h = 0
  } else if (t.bareHour) {
    h += 12 // 방탈출 벙은 낮·저녁이 대부분이라 1~9시는 오후로 본다
  }
  if (h === 24 && t.minute === 0) h = 0
  return h <= 23 ? h : null
}

/** tokens[i] 가 "-", "~" 로 이어진 범위의 시작이면 끝 토큰을 돌려준다 */
function rangeEnd(text: string, tokens: TimeToken[], i: number): TimeToken | null {
  const next = tokens[i + 1]
  if (!next) return null
  const between = text.slice(tokens[i].end, next.start)
  // "13시~18시", "2시부터 6시~7시까지" (부터 뒤 첫 시각을 끝으로 본다)
  return /^\s*(?:[-~]|부터)\s*$/.test(between) ? next : null
}

function pickTime(text: string, tokens: TimeToken[], segments: [number, number][]): { startTime: string; endTime: string | null } | null {
  for (const [from, to] of segments) {
    const i = tokens.findIndex((t) => t.start >= from && t.start < to)
    if (i < 0) continue
    const t = tokens[i]
    // 하한("7시 이후로")만 있는 글은 시작 시각을 단정하지 않는다
    if (t.lowerBound) return null
    const sh = resolveHour(t)
    if (sh == null) continue
    const startTime = formatHm(sh, t.minute)
    let endTime: string | null = null
    const e = rangeEnd(text, tokens, i)
    if (e) {
      let eh = resolveHour(e, t.marker === 'pm')
      if (eh != null) {
        if (eh * 60 + e.minute <= sh * 60 + t.minute && eh + 12 <= 23 && (eh + 12) * 60 + e.minute > sh * 60 + t.minute) eh += 12
        endTime = formatHm(eh, e.minute)
      }
    }
    return { startTime, endTime }
  }
  return null
}

/** 고른 날짜 후보와 연도까지 정한 날짜. 약한 후보가 비현실적인 날짜가 되면 버린다. */
function resolveDate(norm: string, cands: DateCandidate[], posted: YMD): { cand: DateCandidate; ymd: YMD } | null {
  const cand = selectDate(norm, cands)
  if (!cand) return null
  const year = cand.year ?? inferYear(cand.month, cand.day, cand.weekday, posted)
  if (year == null || !validMonthDay(cand.month, cand.day, year)) return null
  const ymd = { year, month: cand.month, day: cand.day }
  // "3/3" 만 덩그러니 있고 몇 달 뒤로 추정되면 날짜보다 인원 표기일 가능성이 크다
  if (cand.strength === 'weak' && dayDiff(ymd, posted) > WEAK_MAX_DAYS_AHEAD) return null
  return { cand, ymd }
}

function weekdayConflict({ cand, ymd }: { cand: DateCandidate; ymd: YMD }): boolean {
  return cand.weekday != null && weekdayOf(ymd.year, ymd.month, ymd.day) !== cand.weekday
}

/** parseSchedule 이 요일이 안 맞아 날짜를 버렸다면 그 내용. 아니면 null */
export function findDateConflict(text: string, postedAt: Date): DateConflict | null {
  const norm = normalizeText(text)
  const resolved = resolveDate(norm, findDateCandidates(norm), kstParts(postedAt))
  if (!resolved || !weekdayConflict(resolved)) return null
  const { year, month, day } = resolved.ymd
  return { date: formatYmd(year, month, day), writtenWeekday: resolved.cand.weekday!, actualWeekday: weekdayOf(year, month, day) }
}

/**
 * 제목 + "\n" + 본문에서 일정 날짜/시간을 찾는다. 날짜가 없으면 null.
 * postedAt 은 연도 추정(게시일보다 60일 넘게 과거면 다음 해)과 상대 날짜에 쓴다.
 */
export function parseSchedule(text: string, postedAt: Date): ParsedSchedule | null {
  const norm = normalizeText(text)
  const posted = kstParts(postedAt)
  const cands = findDateCandidates(norm)
  const tEnd = titleEnd(norm)

  const resolved = resolveDate(norm, cands, posted)
  // 적힌 요일이 그 날짜의 실제 요일과 다르면 날짜·요일 중 무엇이 맞는지 알 수 없으므로 날짜 미확인으로 둔다
  if (resolved && weekdayConflict(resolved)) return null
  const chosen = resolved?.cand ?? null
  let ymd: YMD | null = resolved?.ymd ?? null
  if (!ymd) ymd = relativeDate(norm.slice(0, tEnd), posted, true)
  // 본문은 뜻이 분명한 "이번주/다음주 X요일"만 쓴다 ("오늘까지 할인" 같은 문구가 많다)
  if (!ymd && cands.length === 0) ymd = relativeDate(norm.slice(tEnd), posted, false)
  if (!ymd) return null

  const tokens = findTimeTokens(norm, cands)
  const len = norm.length
  let segments: [number, number][]
  if (chosen && chosen.start < tEnd) {
    segments = [[chosen.end, tEnd], [0, chosen.start], [tEnd, len]]
  } else if (chosen) {
    segments = [[0, tEnd], [chosen.end, len], [tEnd, chosen.start]]
  } else {
    segments = [[0, len]]
  }
  const time = pickTime(norm, tokens, segments)
  return {
    date: formatYmd(ymd.year, ymd.month, ymd.day),
    startTime: time?.startTime ?? null,
    endTime: time?.endTime ?? null,
  }
}

/** 날짜 없이 시간만 찾는다 (날짜를 못 찾은 글용). 날짜처럼 보이는 N/M 은 시간 후보에서 뺀다. */
export function parseTime(text: string): { startTime: string; endTime: string | null } | null {
  const norm = normalizeText(text)
  const tokens = findTimeTokens(norm, findDateCandidates(norm))
  const tEnd = titleEnd(norm)
  return pickTime(norm, tokens, [[0, tEnd], [tEnd, norm.length]])
}

/** "담달 첫째 주" → "다음달 첫째 주", "이번 주말" → "이번 주말", "다음 주 평일" → "다음주 평일" */
function readRelative(m: RegExpMatchArray): string {
  const prefix = m[1] === '담' ? '다음' : m[1]
  if (m[2] === '주말') return `${prefix} 주말`
  const base = `${prefix}${m[2]}`
  return [base, m[3] && `${m[3]} 주`, m[4]].filter(Boolean).join(' ')
}

// 날짜를 못 찾은 글에서 대략의 때를 읽는다. 달력에 올리지는 않고 상세에 '언제쯤'으로만 보여 준다.
const WHEN_HINTS: { re: RegExp; read: (m: RegExpMatchArray) => string }[] = [
  // "10/?", "10월 중", "10월 초", "다음달 첫째 주"
  { re: /(?<!\d)(1[0-2]|[1-9])\s*[/.]\s*[?？]/, read: (m) => `${m[1]}월 중` },
  { re: /(?<!\d)(1[0-2]|[1-9])\s*월\s*(중순|초|말|중)(?=쯤|경|[^가-힣]|$)/, read: (m) => `${m[1]}월 ${m[2]}` },
  { re: /(이번|다음|담)\s*(달|주말|주)(?:\s*(첫째|둘째|셋째|넷째|마지막)\s*주)?(?:\s*(주말|평일))?/, read: readRelative },
  { re: /(주말|평일)(?:\s*(오전|오후|낮|저녁|밤))?/, read: (m) => (m[2] ? `${m[1]} ${m[2]}` : m[1]) },
  { re: /(?<![가-힣])([월화수목금토일])요일/, read: (m) => `${m[1]}요일` },
]

/** 날짜 없는 글의 '언제쯤' 단서 ("10월 중", "다음달 첫째 주", "주말", "금요일"). 제목을 먼저 본다. 없으면 null */
export function parseWhenHint(text: string): string | null {
  const norm = normalizeText(text)
  const tEnd = titleEnd(norm)
  for (const part of [norm.slice(0, tEnd), norm.slice(tEnd)]) {
    for (const h of WHEN_HINTS) {
      const m = part.match(h.re)
      if (m) return h.read(m).trim()
    }
  }
  return null
}

/**
 * "3/3", "(2/6)", "2/3 미현, 성희", "(3/2~3)" 같은 참여 인원. 날짜로 쓰인 것은 건너뛰고 마지막 것을 쓴다.
 * postedAt 을 주면 parseSchedule 과 같은 기준으로 '실제로 날짜로 쓰인' 후보만 뺀다
 * (없으면 날짜로 고를 만한 후보를 뺀다).
 */
export function parseParticipants(text: string, postedAt?: Date): Participants | null {
  const found = findParticipants(normalizeText(text), postedAt)
  return found && { current: found.current, max: found.max }
}

function findParticipants(norm: string, postedAt?: Date): (Participants & { end: number }) | null {
  const cands = findDateCandidates(norm)
  const chosen = postedAt ? (resolveDate(norm, cands, kstParts(postedAt))?.cand ?? null) : selectDate(norm, cands)
  const excluded = cands.filter((c) => c.strength === 'strong' || c === chosen)
  const re = /(?<![\d.\/:~])(\d{1,2})(?:\s*~\s*(\d{1,2}))?[ \t]*\/[ \t]*(\d{1,2})(?:\s*~\s*(\d{1,2}))?(?![\d\/.:])/g
  let found: (Participants & { end: number }) | null = null
  for (const m of norm.matchAll(re)) {
    const span = { start: m.index, end: m.index + m[0].length }
    if (excluded.some((c) => overlaps(c, span))) continue
    const current = Number(m[1])
    const max = Number(m[4] ?? m[3])
    if (max < 2 || max > 30 || current > max) continue
    // 12 초과 정원은 "인원/멤버/현재" 표시가 있을 때만 (날짜 오인 방지)
    if (max > 12 && !/(인원|멤버|현재|참여)\s*[:(]?\s*$/.test(norm.slice(Math.max(0, span.start - 8), span.start))) continue
    found = { current, max, end: span.end }
  }
  return found
}

/** 이름 목록에 흔히 섞이는, 이름이 아닌 낱말 */
const NOT_NAMES = new Set(['모집', '구해요', '구함', '마감', '확정', '예정', '대기', '가능', '환영', '인원', '멤버', '현재', '참여', '부참', '추가'])

/**
 * 인원 표기 바로 뒤, 같은 줄의 참여자 이름 ("3/3 동건 미현 무성", "(2/3): 이원형, 김가영").
 * 2~4자 한글만 이름으로 보고, 괄호나 다른 글자가 나오면 멈춘다. 본문이 잘려 끝에 남은 한 글자는 버린다.
 */
export function parseMembers(text: string, postedAt?: Date): string[] {
  const norm = normalizeText(text)
  const found = findParticipants(norm, postedAt)
  if (!found) return []
  const nl = norm.indexOf('\n', found.end)
  const rest = norm.slice(found.end, nl < 0 ? norm.length : nl).replace(/^[\s)\]:：]+/, '')
  const names: string[] = []
  for (const tok of rest.split(/[\s,，/·、]+/)) {
    if (!tok) continue
    const m = tok.match(/^([가-힣]{2,4})(?:[(（].*)?$/)
    if (!m || NOT_NAMES.has(m[1])) break
    names.push(m[1])
    if (tok !== m[1]) break // "필수(2인…" 처럼 괄호가 붙으면 그 이름까지만
  }
  return names
}

// ---- 상태/제목 ----

const STATUS_MARKER_RE = /[\[(【]\s*(?:급벙\s*)?마감\s*[\])】]/g
/** "(펑)", "[펑]", "(매장이슈로 펑)" — 모임이 취소(무산)됐다는 표시 */
const CANCEL_MARKER_RE = /[\[(【][^\[\]()【】]{0,12}펑\s*[\])】]/g

/** 제목에서 [마감]/(마감)/(펑)/"마감)" 같은 상태 표시를 지운다 (취소 여부는 isCancelledTitle 로 따로 싣는다) */
export function stripStatusMarkers(title: string): string {
  return title
    .replace(STATUS_MARKER_RE, ' ')
    .replace(CANCEL_MARKER_RE, ' ')
    .replace(/^\s*마감\s*[)\]]?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 제목에 펑(취소) 표시가 있는지. 본문의 "인원 없으면 펑할게요" 같은 조건문은 보지 않는다. */
export function isCancelledTitle(title: string): boolean {
  return new RegExp(CANCEL_MARKER_RE.source).test(title)
}

/**
 * 모집이 끝났다는 표시. "마감"이 들어갔다고 다 마감은 아니다 ("마감 임박", "마감되면 공지할게요").
 * - 괄호 표시: [마감] (마감) 【급벙마감】, 제목 맨 앞의 "마감)"
 * - 끝났다는 말: 마감했/마감됐/마감되었/마감입니다/마감이에요/마감완료/모집 마감(뒤에 임박·예정·되면 등이 없을 때)
 * - (펑) [펑] 취소 표시
 */
const CLOSED_RE = new RegExp(
  [
    '[\\[(【]\\s*(?:급벙\\s*)?마감\\s*[\\])】]',
    '^\\s*마감\\s*[)\\]]',
    '마감\\s*(?:했|됐|되었|입니다|이에요|이요|완료)',
    '모집\\s*마감(?!\\s*(?:임박|예정|전|되면|될|시|까지|일))',
    '[\\[(]\\s*펑\\s*[\\])]',
  ].join('|'),
  'm',
)

export function hasClosedMarker(text: string): boolean {
  return CLOSED_RE.test(text)
}

/**
 * 공포 테마 벙인지. 게시판에 따로 표시가 없어 낱말로 판단한다.
 * - 공포·호러·공테(공포테마 줄임)
 * - 쫄(겁 많은 사람, 쫄보·극쫄)·탱(앞장서는 사람, 탱커) — 공포 테마에서만 쓰는 역할 구분
 * - 무섭다(무서우니까·무서운)·겁 많다·겁쟁이·겁보
 * '쫄깃'·'쫄면'·'탱탱'·'탱고'·'즐겁게' 같은 일상어는 뺀다 (겁은 '겁 많'·'겁쟁이'·'겁보'만).
 */
const HORROR_RE = /공포|호러|horror|공테|쫄(?![깃면])|(?<!탱)탱(?![탱고])|무서|무섭|겁\s*(?:많|쟁이|보)/i

export function isHorrorText(text: string): boolean {
  return HORROR_RE.test(text)
}

const ROLE_COUNT = (role: string) => new RegExp(`${role}(?![깃면탱고])\\s*(\\d{1,2})\\s*(?:명|인)?`)
const ROLE_ANY_RE = /쫄\s*[,/·]?\s*탱|탱\s*[,/·]?\s*쫄/
const ROLE_ANY_AFTER_RE = /^[^\n]{0,8}?(?:무관|상관\s*없|상관없|구분\s*없|가리지\s*않|다\s*환영|모두\s*환영)/
const ROLE_WANT = (role: string) =>
  new RegExp(`(?:극)?${role}(?:보|이|을|를|분|님)?\\s*(?:\\d{1,2}\\s*(?:명|인)?\\s*)?(?:찾|구해|구함|구합|모집|우선|환영|급구|필요)`)

/** 제목·미리보기에서 쫄/탱 인원과 찾는 역할을 읽는다. 아무것도 없으면 null */
export function parseHorrorRoles(text: string): HorrorRoles | null {
  const norm = normalizeText(text)
  const count = (role: string) => {
    const m = norm.match(ROLE_COUNT(role))
    return m ? Number(m[1]) : null
  }
  const jjol = count('쫄')
  const tang = count('탱')
  let wanted: HorrorRoles['wanted'] = null
  const pair = norm.match(ROLE_ANY_RE)
  if (pair && ROLE_ANY_AFTER_RE.test(norm.slice(pair.index! + pair[0].length))) wanted = 'any'
  else {
    const wj = ROLE_WANT('쫄').test(norm)
    const wt = ROLE_WANT('탱').test(norm)
    // 쫄·탱 인원이 둘 다 적혀 있으면("쫄1 탱2 모집") 한쪽만 찾는 게 아니므로 인원만 쓴다
    wanted = jjol != null && tang != null ? null : wj && wt ? 'any' : wj ? 'jjol' : wt ? 'tang' : null
  }
  if (jjol == null && tang == null && wanted == null) return null
  return { jjol, tang, wanted }
}
