const LEADING_DATE = /^\s*(?:\d{1,2}\s*[/.]\s*\d{1,2}|\d{1,2}\s*월\s*\d{1,2}\s*일)\s*(?:\([^)]*\))?\s*/

/** 달력 칸은 이미 날짜를 보여 주므로 제목 앞의 '10/3(토)' 같은 날짜를 뗀다 */
export function shortTitle(title: string): string {
  return title.replace(LEADING_DATE, '') || title
}

/** 작은 칸에 늘 같은 모양이 나오도록 키로 시드를 만드는 난수 (LCG) */
export function seededRandom(key: string): () => number {
  let seed = [...key].reduce((a, ch) => a + ch.charCodeAt(0), 0)
  return () => (seed = (seed * 9301 + 49297) % 233280) / 233280
}
