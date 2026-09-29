// 제로월드 홍대점 — POST /reservation/theme 기반 API
// 1) GET /reservation/{storeId} → CSRF 토큰 + 세션 쿠키 확보
// 2) POST /reservation/theme → 날짜별 테마·시간·가격 데이터

export interface ZerohongdaeRawTheme {
  PK: number;
  thumb: string;
  title: string;
  description: string;
  weekendPK: number | null;
}

export interface ZerohongdaeRawTime {
  themePK: number;
  time: string; // "14:00:00"
  reservation: boolean; // true = 예약됨, false = 빈자리
  timeKO: string; // "14시 00분"
}

export interface ZerohongdaeRawPricing {
  themePK: number;
  people: number;
  price: string; // "90,000"
}

export interface ZerohongdaeThemeResponse {
  data: ZerohongdaeRawTheme[];
  times: Record<string, ZerohongdaeRawTime[]>;
  pricing: Record<string, ZerohongdaeRawPricing[]>;
}

export interface ZerohongdaeSession {
  csrfToken: string;
  cookies: string;
}

export interface ZerohongdaeBookingPayload {
  themePK: number;
  reservationTime: string; // "HH:MM:SS"
  reservationDate: string; // "YYYY-MM-DD"
  name: string;
  phone: string;
  people: number;
  paymentType: number;
}

export interface ZerohongdaeBookingResponse {
  success: boolean;
  message?: string;
}

export const BASE_URL = 'https://zerohongdae.com';

export const fetchSession = async (storeId: number): Promise<ZerohongdaeSession> => {
  const res = await fetch(`${BASE_URL}/reservation/${storeId}`);
  if (!res.ok) throw new Error(`zerohongdae fetchSession: ${res.status}`);

  const html = await res.text();
  const csrfMatch = html.match(/name="csrf-token"[^>]*content="([^"]+)"/);
  if (!csrfMatch) throw new Error('zerohongdae: CSRF token not found');

  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookies = setCookies.map((c) => c.split(';')[0]).join('; ');

  return { csrfToken: csrfMatch[1], cookies };
};

export const fetchThemesByDate = async (
  storeId: number,
  date: string,
  session: ZerohongdaeSession,
): Promise<ZerohongdaeThemeResponse> => {
  const res = await fetch(`${BASE_URL}/reservation/theme`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-CSRF-TOKEN': session.csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': session.cookies,
      'Referer': `${BASE_URL}/reservation/${storeId}`,
    },
    body: `reservationDate=${date}&name=&phone=&paymentType=1`,
  });
  if (!res.ok) throw new Error(`zerohongdae fetchThemes: ${res.status}`);
  return res.json();
};

export const submitBooking = async (
  storeId: number,
  payload: ZerohongdaeBookingPayload,
  session: ZerohongdaeSession,
): Promise<ZerohongdaeBookingResponse> => {
  const body = new URLSearchParams({
    themePK: String(payload.themePK),
    reservationTime: payload.reservationTime,
    reservationDate: payload.reservationDate,
    name: payload.name,
    phone: payload.phone,
    people: String(payload.people),
    paymentType: String(payload.paymentType),
    policy: 'on',
  });

  const res = await fetch(`${BASE_URL}/reservation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-CSRF-TOKEN': session.csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': session.cookies,
      'Referer': `${BASE_URL}/reservation/${storeId}`,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`zerohongdae submitBooking: ${res.status}`);
  return res.json();
};
