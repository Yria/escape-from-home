// 지구별방탈출 — 서버 렌더링 예약 페이지 파싱 기반 (JSON API 없음)
//
// 조회: GET /reservation?branch={branch}&theme={theme?}&date={date}
//   → 지점의 테마 목록 + 각 테마의 시간대가 HTML로 렌더링됨.
//   → theme 파라미터를 지정하면 해당 테마 섹션(res-item)만 렌더링됨.
//
// 예약 흐름 (2단계 폼):
//   1) 리스트 페이지의 예약가능 버튼(.eveReservationButton) 클릭
//      → reservation.js가 .eveHiddenData({branch,theme,date,time})를 읽어
//        #eveSubmitForm(hidden: branch/theme/date/time/_token)을 채우고 submit
//      → POST /reservation/create
//   2) 정보입력 페이지에서 name/phone/people/payment_method/policy 입력
//      → #eveReservationBtn 최종 제출 (사용자가 직접 수행)

export const BASE_URL = 'https://www.xn--2e0b040a4xj.com';

/** 지점 코드 → 지점명 */
export const BRANCHES: Record<number, string> = {
  1: '대구점',
  2: '홍대어드벤처점',
  4: '홍대라스트시티점',
};

export interface JigubyeolRawTheme {
  id: number; // <select name="theme"> option value
  branch: number;
  name: string;
  imageUrl?: string;
  genre?: string;
  minPlayers: number;
  maxPlayers: number;
  duration: number; // 분
  difficulty?: number;
}

export interface JigubyeolRawSlot {
  time: string; // "HH:MM" (zero-padded)
  available: boolean;
}

// 예약은 HTML 폼 흐름(POST /reservation/create → 최종 제출)이며 JSON 예약 API가 없다.
// 최종 제출은 사용자가 페이지에서 직접 수행하므로 별도의 submitBooking은 제공하지 않는다.
// (payload/response 형태는 폼 필드 기준 문서화 목적으로만 남긴다.)
export interface JigubyeolBookingPayload {
  branch: number;
  theme: number;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  name: string;
  phone: string; // "010-1234-5678"
  people: number;
  paymentMethod: number; // 21 = 가상계좌
}

/** HTML 엔티티 디코드 (&lt; &gt; &quot; &#039; &amp;) */
export const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

/** "HH:MM" 정규화 (한 자리 시 → 0-padding) */
const normalizeTime = (raw: string): string => {
  const [h, m] = raw.split(':');
  return `${(h ?? '').padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}`;
};

export const fetchReservationHtml = async (
  branch: number,
  date: string,
  theme?: number,
): Promise<string> => {
  const themeParam = theme != null ? String(theme) : '';
  const url = `${BASE_URL}/reservation?branch=${branch}&theme=${themeParam}&date=${date}`;
  const res = await fetch(url, {
    headers: {
      // node(fetch) 환경 대응용. 브라우저에서는 forbidden header로 무시됨.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  if (!res.ok) throw new Error(`jigubyeol fetchReservationHtml: ${res.status}`);
  return res.text();
};

/** <select name="theme">의 {id, name} 목록 파싱 (전체 옵션 제외) */
export const parseThemeOptions = (
  html: string,
): { id: number; name: string }[] => {
  const sel = html.match(/<select[^>]*name="theme"[\s\S]*?<\/select>/);
  if (!sel) return [];
  const opts: { id: number; name: string }[] = [];
  for (const m of sel[0].matchAll(
    /<option value="(\d+)"[^>]*>([^<]*)<\/option>/g,
  )) {
    opts.push({ id: Number(m[1]), name: decodeEntities(m[2]) });
  }
  return opts;
};

/**
 * res-item 섹션들을 파싱하여 테마 상세를 추출한다.
 * 섹션 자체에는 테마 ID가 없으므로 <select> 옵션(name→id)으로 매칭한다.
 */
export const parseThemes = (
  html: string,
  branch: number,
): JigubyeolRawTheme[] => {
  const nameToId = new Map(parseThemeOptions(html).map((o) => [o.name, o.id]));

  const themes: JigubyeolRawTheme[] = [];
  // 각 섹션 청크는 다음 섹션 직전(마지막은 footer 이전)까지 포함한다.
  const sections = html.split('<section class="res-item').slice(1);

  for (const sec of sections) {
    const nameMatch = sec.match(/<h2[^>]*>([^<]+)<\/h2>/);
    if (!nameMatch) continue;
    const name = decodeEntities(nameMatch[1]);
    const id = nameToId.get(name);
    if (id == null) continue;

    const imgMatch = sec.match(/<img[^>]*src="([^"]+)"/);

    // 상세 테이블: <th>라벨</th><td>값</td>
    const fields = new Map<string, string>();
    for (const f of sec.matchAll(/<th>([^<]+)<\/th>\s*<td>([^<]*)<\/td>/g)) {
      fields.set(f[1].trim(), decodeEntities(f[2]));
    }

    // 인원 범위 구분자는 지점/테마마다 '-' 또는 '~'(및 대시/물결 변형) 혼용
    const players = (fields.get('인원') ?? '').match(/(\d+)\s*[-~～〜–—−]\s*(\d+)/);
    const duration = (fields.get('시간') ?? '').match(/(\d+)/);
    const difficulty = (fields.get('난이도') ?? '').match(/([\d.]+)/);

    themes.push({
      id,
      branch,
      name,
      imageUrl: imgMatch ? imgMatch[1] : undefined,
      genre: fields.get('장르') || undefined,
      minPlayers: players ? Number(players[1]) : 1,
      maxPlayers: players ? Number(players[2]) : 6,
      duration: duration ? Number(duration[1]) : 60,
      difficulty: difficulty ? Number(difficulty[1]) : undefined,
    });
  }

  return themes;
};

/**
 * 시간 슬롯 파싱. 렌더 순서를 보존한다 (nth-child 인덱스 계산용).
 * 단일 테마(?theme=) 페이지 기준 — 첫 번째 .res-times 목록을 파싱한다.
 * 예약가능 판별: 해당 <li>에 .eveReservationButton 클래스 존재 여부.
 */
export const parseSlots = (html: string): JigubyeolRawSlot[] => {
  const ul = html.match(/<ul class="res-times[^"]*">([\s\S]*?)<\/ul>/);
  if (!ul) return [];

  const slots: JigubyeolRawSlot[] = [];
  for (const li of ul[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
    const liHtml = li[1];
    const timeMatch = liHtml.match(/<span[^>]*>\s*(\d{1,2}:\d{2})\s*<\/span>/);
    if (!timeMatch) continue;
    slots.push({
      time: normalizeTime(timeMatch[1]),
      available: /eveReservationButton/.test(liHtml),
    });
  }
  return slots;
};
