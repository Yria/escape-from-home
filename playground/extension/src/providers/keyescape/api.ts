export interface KeyescapeWorksTheme {
  infoNum: number;
  zizumNum: number;
  themeNum: number;
  name: string;
  imageUrl: string;
  branchName: string;
}

export interface KeyescapeRawTimeSlot {
  num: number;
  gubun: string;
  theme_num: number;
  hh: string;
  mm: string;
  enable: 'Y' | 'N';
  sale_ck: string;
  sale_price: number;
  sale_txt: string;
}

export interface KeyescapeRawTimeResponse {
  status: boolean;
  data: KeyescapeRawTimeSlot[];
}

const BASE_URL = 'https://www.keyescape.com';
const API_URL = `${BASE_URL}/controller/run_proc.php`;

/**
 * works.php 1회 호출로 모든 지점의 테마 목록 + 이미지 URL을 파싱한다.
 */
export const fetchAllThemes = async (): Promise<KeyescapeWorksTheme[]> => {
  const res = await fetch(`${BASE_URL}/works.php`);
  if (!res.ok) throw new Error(`keyescape fetchAllThemes: ${res.status}`);
  const html = await res.text();

  const themes: KeyescapeWorksTheme[] = [];
  const branchHeaders = [...html.matchAll(/<h\d[^>]*>([^<]+)<\/h/g)].map(
    (m) => ({ pos: m.index!, name: m[1].trim() }),
  );

  const cardPattern =
    /data-num=(\d+)\s+data-zizum=(\d+)\s+data-theme=(\d+)\s*>\s*<img\s+src="([^"]+)"[\s\S]*?<span>([^<]+)<\/span>/g;

  for (const m of html.matchAll(cardPattern)) {
    const pos = m.index!;
    let branchName = '';
    for (const h of branchHeaders) {
      if (h.pos < pos) branchName = h.name;
      else break;
    }

    themes.push({
      infoNum: Number(m[1]),
      zizumNum: Number(m[2]),
      themeNum: Number(m[3]),
      imageUrl: m[4],
      name: m[5].trim(),
      branchName,
    });
  }

  return themes;
};

/**
 * 예약 페이지에서 테마의 doing(예약 가능 일수) 값을 파싱한다.
 * 캘린더는 today ~ today+(doing-1) 범위만 available로 표시.
 */
export const fetchDoing = async (
  zizumNum: number,
  themeNum: number,
  infoNum: number,
): Promise<number> => {
  const url = `${BASE_URL}/reservation1.php?zizum_num=${zizumNum}&theme_num=${themeNum}&theme_info_num=${infoNum}`;
  const res = await fetch(url);
  if (!res.ok) return 14; // fallback
  const html = await res.text();
  const match = html.match(new RegExp(`data-doing="(\\d+)"\\s+data-themenum="${themeNum}"\\s+selected`));
  if (match) return Number(match[1]);
  // selected 없으면 첫 번째 매칭
  const fallback = html.match(new RegExp(`data-doing="(\\d+)"\\s+data-themenum="${themeNum}"`));
  return fallback ? Number(fallback[1]) : 14;
};

export const fetchTimeSlotsByTheme = async (
  date: string,
  zizumNum: number,
  themeNum: number,
): Promise<KeyescapeRawTimeResponse> => {
  const body = new URLSearchParams({
    t: 'get_theme_time',
    date,
    zizumNum: String(zizumNum),
    themeNum: String(themeNum),
    endDay: '0',
  });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`keyescape fetchTimeSlotsByTheme: ${res.status}`);
  return res.json();
};
