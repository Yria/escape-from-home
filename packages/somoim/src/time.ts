/** 소모임 타임스탬프는 unix 초에서 1e9 를 뺀 값이다 */
export const SOMOIM_EPOCH_OFFSET = 1_000_000_000
/** 고정 공지의 w_t 는 이 값(가짜)으로 내려온다 */
export const PINNED_WRITE_TIME = 2_000_000_000

const KST_OFFSET_MS = 9 * 3600 * 1000
const DAY_MS = 86_400_000

export function somoimTimeToDate(t: number): Date {
  return new Date((t + SOMOIM_EPOCH_OFFSET) * 1000)
}

export function dateToSomoimTime(d: Date): number {
  return Math.floor(d.getTime() / 1000) - SOMOIM_EPOCH_OFFSET
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Date 를 KST 기준으로 쪼갠다 (month 1~12, weekday 0=일) */
export function kstParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number } {
  const k = new Date(d.getTime() + KST_OFFSET_MS)
  return {
    year: k.getUTCFullYear(),
    month: k.getUTCMonth() + 1,
    day: k.getUTCDate(),
    hour: k.getUTCHours(),
    minute: k.getUTCMinutes(),
    second: k.getUTCSeconds(),
    weekday: k.getUTCDay(),
  }
}

/** 'YYYY-MM-DD' (KST) */
export function toKstDateString(d: Date): string {
  const p = kstParts(d)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** ISO 8601, +09:00 오프셋 */
export function toKstIso(d: Date): string {
  const p = kstParts(d)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}+09:00`
}

export function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function formatHm(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** 달력 날짜의 요일 (0=일) */
export function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** 달력 날짜(KST 자정) 간 일수 차 a - b */
export function dayDiff(a: { year: number; month: number; day: number }, b: { year: number; month: number; day: number }): number {
  return Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / DAY_MS)
}

export function addDays(p: { year: number; month: number; day: number }, n: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** 게시 시각: 고정 공지는 w_t 가 가짜라 ot 를 쓴다 */
export function articlePostedAt(a: { w_t: number; ot: number }): Date {
  return somoimTimeToDate(a.w_t >= PINNED_WRITE_TIME ? a.ot : a.w_t)
}
