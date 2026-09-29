import { fetchArticles } from './api.ts'
import { findDateConflict, hasClosedMarker, isCancelledTitle, isHorrorText, parseHorrorRoles, parseMembers, parseParticipants, parseTime, parseWhenHint, parseSchedule, stripStatusMarkers } from './parse.ts'
import { articlePostedAt, toKstDateString, toKstIso } from './time.ts'
import {
  DEFAULT_GROUP_ID,
  DEFAULT_GROUP_NAME,
  type ArticleCategory,
  type Participants,
  type EventStatus,
  type ScheduleEvent,
  type ScheduleSnapshot,
  type SomoimArticle,
  type UndatedPost,
} from './types.ts'

const IMAGE_CDN = 'https://d3vo2hyhx9t76k.cloudfront.net'
const GROUP_IMAGE_CDN = 'https://d228e474i2d5yf.cloudfront.net'

/** 일정 날짜가 오늘(KST)로부터 이 일수보다 과거면 뺀다 */
export const DEFAULT_PAST_DAYS = 14
/** 모임 날짜보다 먼저 올라오는 글을 놓치지 않도록, 게시일은 이만큼 더 거슬러 수집한다 */
export const POST_LEAD_DAYS = 30
const DAY_MS = 86_400_000

export const groupUrl = (gid: string) => `https://www.somoim.co.kr/${gid}`
/**
 * 소모임이 직접 제공하는 '앱으로 모임 바로 이동' 페이지. iOS 는 somoim://…?type=63&gid=, Android 는 intent:// 로
 * 앱의 모임을 열고 앱이 없으면 스토어로 보낸다. 글 하나로 가는 링크(웹·앱 모두)는 소모임에 없다.
 */
export const groupAppUrl = (gid: string) => `https://www.somoim.co.kr/m/deeplink/${gid}`

/** 앱의 딥링크. type=63 이 모임 화면이다 (앱 5.8.3 FCAppActivity 기준, 글 화면을 여는 type 은 없다) */
const APP_GROUP_PATH = (gid: string) => `com.friendscube.Somoim?type=63&gid=${encodeURIComponent(gid)}`
export type AppPlatform = 'android' | 'ios'
/**
 * 중간 페이지(`groupAppUrl`) 없이 앱의 모임 화면을 바로 여는 주소 (소모임 웹이 쓰는 것과 같은 형식).
 * Android 는 앱이 없으면 Chrome 이 package 로 스토어를 연다. iOS 는 앱이 없으면 열리지 않는다.
 */
export const groupAppLaunchUrl = (gid: string, platform: AppPlatform) =>
  platform === 'android'
    ? `intent://${APP_GROUP_PATH(gid)}#Intent;scheme=somoim;action=android.intent.action.VIEW;` +
      `category=android.intent.category.BROWSABLE;package=com.friendscube.somoim;end`
    : `somoim://${APP_GROUP_PATH(gid)}`
export const groupImageUrl = (gid: string) => `${GROUP_IMAGE_CDN}/${gid}.png`
export const avatarUrl = (wid: string) => `${IMAGE_CDN}/${wid}.png`

export type ArticleImageSize = 'tiny' | 'small' | 'medium' | 'full'
const SIZE_SUFFIX: Record<ArticleImageSize, string> = { tiny: 'n', small: 's', medium: 'm', full: '' }
export const articleImageUrl = (articleId: string, size: ArticleImageSize = 'full', index = 1) =>
  `${IMAGE_CDN}/${articleId}${SIZE_SUFFIX[size]}${index}.png`

const CATEGORIES: readonly ArticleCategory[] = ['A', 'F', 'I', 'J', 'E', 'V']
/** 캘린더에서 아예 빼는 분류: 공지·가입인사·투표 */
const EXCLUDED: readonly string[] = ['A', 'J', 'V']
/** 날짜가 없을 때 '날짜 미확인'으로 보여줄 분류 */
const UNDATED_ALLOWED: readonly string[] = ['I', 'F', 'E']

export function toCategory(cat: string): ArticleCategory {
  return (CATEGORIES as readonly string[]).includes(cat) ? (cat as ArticleCategory) : 'F'
}

/** 본문(c)은 제목으로 시작한다. 제목을 떼고 남은 앞부분 */
export function articlePreview(a: Pick<SomoimArticle, 'at' | 'c'>): string {
  const c = a.c ?? ''
  return (c.startsWith(a.at) ? c.slice(a.at.length) : c).trim()
}

/**
 * 모임 규칙: 관심사(I)=모집중, 자유(F)=마감·진행대기, 모임후기(E)=완료.
 * 펑(취소)된 모임은 열리지 않았으므로 분류와 상관없이 '마감'으로 두고 cancelled 로 표시한다.
 * 작성자가 분류를 옮기지 않았어도 아래는 마감으로 본다.
 * - 제목·미리보기에 [마감]·"마감했습니다" 같은 표시 (hasClosedMarker — "마감 임박"은 아님)
 * - 인원이 다 찼다 (3/3)
 * - 모임 날짜가 오늘(KST)보다 지났다
 */
export function articleStatus(
  a: Pick<SomoimArticle, 'at' | 'c' | 'cat'>,
  ctx: { date?: string | null; participants?: Participants | null; today?: string } = {},
): EventStatus {
  if (isCancelledTitle(a.at)) return 'closed'
  if (a.cat === 'E') return 'done'
  if (a.cat === 'F' || hasClosedMarker(a.at) || hasClosedMarker(articlePreview(a))) return 'closed'
  if (ctx.participants && ctx.participants.current >= ctx.participants.max) return 'closed'
  if (ctx.date && ctx.today && ctx.date < ctx.today) return 'closed'
  if (a.cat === 'I') return 'open'
  return 'closed'
}

/** 날짜를 찾지 못하면 null */
export function toScheduleEvent(a: SomoimArticle, now: Date = new Date()): ScheduleEvent | null {
  const preview = articlePreview(a)
  const text = `${a.at}\n${preview}`
  const posted = articlePostedAt(a)
  const sched = parseSchedule(text, posted)
  if (!sched) return null
  const hasImage = a.ic > 0
  const participants = parseParticipants(text, posted)
  const horror = isHorrorText(text)
  return {
    id: a.id,
    title: stripStatusMarkers(a.at) || a.at.trim(),
    rawTitle: a.at,
    preview,
    author: a.wn,
    authorAvatarUrl: avatarUrl(a.wid),
    date: sched.date,
    startTime: sched.startTime,
    endTime: sched.endTime,
    status: articleStatus(a, { date: sched.date, participants, today: toKstDateString(now) }),
    cancelled: isCancelledTitle(a.at),
    horror,
    roles: horror ? parseHorrorRoles(text) : null,
    category: toCategory(a.cat),
    thumbnailUrl: hasImage ? articleImageUrl(a.id, 'small') : null,
    imageUrl: hasImage ? articleImageUrl(a.id, 'full') : null,
    participants,
    members: parseMembers(text, posted),
    commentCount: a.rn,
    postedAt: toKstIso(posted),
    groupId: a.gid || DEFAULT_GROUP_ID,
    articleUrl: groupUrl(a.gid || DEFAULT_GROUP_ID),
    appUrl: groupAppUrl(a.gid || DEFAULT_GROUP_ID),
  }
}

export function toUndatedPost(a: SomoimArticle): UndatedPost {
  const preview = articlePreview(a)
  const text = `${a.at}\n${preview}`
  const posted = articlePostedAt(a)
  const time = parseTime(text)
  const hasImage = a.ic > 0
  const participants = parseParticipants(text, posted)
  const horror = isHorrorText(text)
  return {
    id: a.id,
    title: stripStatusMarkers(a.at) || a.at.trim(),
    rawTitle: a.at,
    preview,
    author: a.wn,
    authorAvatarUrl: avatarUrl(a.wid),
    whenHint: parseWhenHint(text),
    dateConflict: findDateConflict(text, posted),
    startTime: time?.startTime ?? null,
    endTime: time?.endTime ?? null,
    postedAt: toKstIso(posted),
    status: articleStatus(a, { participants }),
    cancelled: isCancelledTitle(a.at),
    horror,
    roles: horror ? parseHorrorRoles(text) : null,
    category: toCategory(a.cat),
    thumbnailUrl: hasImage ? articleImageUrl(a.id, 'small') : null,
    imageUrl: hasImage ? articleImageUrl(a.id, 'full') : null,
    participants,
    members: parseMembers(text, posted),
    commentCount: a.rn,
    groupId: a.gid || DEFAULT_GROUP_ID,
    articleUrl: groupUrl(a.gid || DEFAULT_GROUP_ID),
    appUrl: groupAppUrl(a.gid || DEFAULT_GROUP_ID),
  }
}

export function compareEvents(a: ScheduleEvent, b: ScheduleEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.startTime !== b.startTime) {
    if (a.startTime == null) return 1
    if (b.startTime == null) return -1
    return a.startTime < b.startTime ? -1 : 1
  }
  return a.postedAt < b.postedAt ? -1 : a.postedAt > b.postedAt ? 1 : 0
}

/** 이미 받아 둔 글 목록으로 스냅샷을 만든다 (네트워크 없음) */
export function snapshotFromArticles(
  articles: SomoimArticle[],
  opts: { groupId?: string; now?: Date; pastDays?: number } = {},
): ScheduleSnapshot {
  const gid = opts.groupId ?? DEFAULT_GROUP_ID
  const now = opts.now ?? new Date()
  // pastDays 가 없으면 거르지 않는다. 있으면 일정은 날짜, 날짜 미확인 글은 게시일로 자른다 (둘 다 KST 'YYYY-MM-DD' 비교)
  const cutoff = opts.pastDays == null ? null : toKstDateString(new Date(now.getTime() - opts.pastDays * DAY_MS))
  const events: ScheduleEvent[] = []
  const undated: UndatedPost[] = []
  for (const a of articles) {
    if (EXCLUDED.includes(a.cat)) continue
    const ev = toScheduleEvent(a, now)
    if (ev) {
      if (cutoff == null || ev.date >= cutoff) events.push(ev)
    } else if (UNDATED_ALLOWED.includes(a.cat)) {
      const post = toUndatedPost(a)
      if (cutoff == null || post.postedAt.slice(0, 10) >= cutoff) undated.push(post)
    }
  }
  events.sort(compareEvents)
  undated.sort((a, b) => (a.postedAt < b.postedAt ? 1 : a.postedAt > b.postedAt ? -1 : 0))
  return {
    groupId: gid,
    groupName: DEFAULT_GROUP_NAME,
    groupUrl: groupUrl(gid),
    groupImageUrl: groupImageUrl(gid),
    generatedAt: toKstIso(now),
    events,
    undated,
  }
}

export async function buildSnapshot(
  opts: {
    groupId?: string
    /** 게시일 수집 하한. 기본 pastDays + POST_LEAD_DAYS 일 전 */
    since?: Date
    fetchImpl?: typeof fetch
    now?: Date
    /** 오늘 기준 며칠 전 일정까지 남길지. 기본 14일 */
    pastDays?: number
    maxPages?: number
    timeoutMs?: number
    signal?: AbortSignal
  } = {},
): Promise<ScheduleSnapshot> {
  const now = opts.now ?? new Date()
  const pastDays = opts.pastDays ?? DEFAULT_PAST_DAYS
  const articles = await fetchArticles({
    groupId: opts.groupId,
    since: opts.since ?? new Date(now.getTime() - (pastDays + POST_LEAD_DAYS) * DAY_MS),
    fetchImpl: opts.fetchImpl,
    maxPages: opts.maxPages,
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
  })
  return snapshotFromArticles(articles, { groupId: opts.groupId, now, pastDays })
}
