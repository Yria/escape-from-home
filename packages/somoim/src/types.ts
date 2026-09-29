export const DEFAULT_GROUP_ID = 'c5d27e88-7d3c-11eb-8444-0a13280ca5bf1'
export const DEFAULT_GROUP_NAME = '방구석을 탈출하는 사람들'

export type ArticleCategory = 'A' | 'F' | 'I' | 'J' | 'E' | 'V'

/** POST /api/articles 응답의 게시글 한 건 (필드명은 소모임 원본 그대로) */
export interface SomoimArticle {
  id: string
  gid: string
  wid: string
  wn: string
  at: string
  c: string
  w_t: number
  ot: number
  m_t?: number
  rn: number
  lc: number
  ic: number
  cat: string
  rcm?: string
  new?: string
}

/** 모집중 / 마감 / 완료 */
export type EventStatus = 'open' | 'closed' | 'done'

export interface ScheduleEvent {
  id: string
  title: string
  rawTitle: string
  preview: string
  author: string
  authorAvatarUrl: string
  date: string
  startTime: string | null
  endTime: string | null
  status: EventStatus
  /** 제목에 (펑)/[펑] 표시 — 모임이 취소됨 (status 는 'closed') */
  cancelled: boolean
  /** 공포 테마 벙 (제목·미리보기의 공포/호러/공테/쫄/탱) */
  horror: boolean
  /** 공포 벙의 쫄/탱 인원·찾는 역할 (공포가 아니거나 적힌 게 없으면 null) */
  roles: HorrorRoles | null
  category: ArticleCategory
  thumbnailUrl: string | null
  imageUrl: string | null
  participants: { current: number; max: number } | null
  /** 인원 표기 뒤에 적힌 참여자 이름 (없으면 빈 배열) */
  members: string[]
  commentCount: number
  postedAt: string
  /** 웹 모임 페이지 (글 하나로 가는 주소는 소모임에 없다) */
  articleUrl: string
  /** 글이 올라온 모임 id (앱 딥링크용) */
  groupId: string
  /** 웹 페이지를 거쳐 앱으로 모임 열기 (앱이 없으면 스토어) */
  appUrl: string
}

/** 날짜를 못 찾은 글. 달력에는 없지만 상세에 보여 줄 수 있는 것은 최대한 읽어 둔다. */
export interface UndatedPost {
  id: string
  title: string
  rawTitle: string
  preview: string
  author: string
  authorAvatarUrl: string
  /** 날짜 대신 찾은 '언제쯤' 단서 ("10월 중", "다음달 첫째 주", "주말", "금요일"). 없으면 null */
  whenHint: string | null
  /** 날짜는 있었지만 요일이 맞지 않아 달력에 올리지 않은 경우 그 내용 */
  dateConflict: DateConflict | null
  startTime: string | null
  endTime: string | null
  postedAt: string
  status: EventStatus
  cancelled: boolean
  horror: boolean
  /** 공포 벙의 쫄/탱 인원·찾는 역할 (공포가 아니거나 적힌 게 없으면 null) */
  roles: HorrorRoles | null
  category: ArticleCategory
  thumbnailUrl: string | null
  imageUrl: string | null
  participants: Participants | null
  members: string[]
  commentCount: number
  groupId: string
  articleUrl: string
  appUrl: string
}

export interface ScheduleSnapshot {
  groupId: string
  groupName: string
  groupUrl: string
  groupImageUrl: string
  generatedAt: string
  events: ScheduleEvent[]
  undated: UndatedPost[]
}

/** 적힌 날짜와 요일이 서로 맞지 않는 경우 ("9/30(목)" 인데 9/30 은 수요일) — 이런 글은 날짜 미확인으로 둔다 */
export interface DateConflict {
  /** 글에 적힌 날짜 'YYYY-MM-DD' (연도는 게시일로 추정) */
  date: string
  /** 글에 적힌 요일 0=일 … 6=토 */
  writtenWeekday: number
  /** 그 날짜의 실제 요일 */
  actualWeekday: number
}

export interface HorrorRoles {
  /** "쫄3", "쫄 2명" — 적힌 쫄(겁 많은 사람) 인원. 없으면 null */
  jjol: number | null
  /** 탱(앞장서는 사람) 인원 */
  tang: number | null
  /** 찾는 역할. 'any' = "쫄탱 무관·상관없이·구분없이" */
  wanted: 'jjol' | 'tang' | 'any' | null
}

export interface ParsedSchedule {
  date: string
  startTime: string | null
  endTime: string | null
}

export interface Participants {
  current: number
  max: number
}
