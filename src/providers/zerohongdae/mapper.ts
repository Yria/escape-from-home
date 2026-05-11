import type { Theme, TimeSlot, BookingRequest, BookingResult } from '../../core/types';
import type {
  ZerohongdaeRawTheme,
  ZerohongdaeRawTime,
  ZerohongdaeRawPricing,
  ZerohongdaeBookingPayload,
  ZerohongdaeBookingResponse,
} from './api';

const PROVIDER_ID = 'zerohongdae';
const THUMB_BASE = 'https://zerohongdae.com/storage';

const parseMinMax = (
  description: string,
  pricing: ZerohongdaeRawPricing[] | undefined,
): { min: number; max: number } => {
  // description에서 "최소 인원 3인 / 최대 인원 4인" 패턴 추출
  const minMatch = description.match(/최소\s*(?:인원\s*)?(\d+)/);
  const maxMatch = description.match(/최대\s*(?:인원\s*)?(\d+)/);
  if (minMatch && maxMatch) {
    return { min: Number(minMatch[1]), max: Number(maxMatch[1]) };
  }
  // pricing 데이터에서 추출
  if (pricing && pricing.length > 0) {
    const people = pricing.map((p) => p.people);
    return { min: Math.min(...people), max: Math.max(...people) };
  }
  return { min: 2, max: 6 };
};

export const toTheme = (
  raw: ZerohongdaeRawTheme,
  pricing?: ZerohongdaeRawPricing[],
): Theme => {
  const { min, max } = parseMinMax(raw.description, pricing);
  return {
    id: `${PROVIDER_ID}:${raw.PK}`,
    providerId: PROVIDER_ID,
    name: raw.title,
    minPlayers: min,
    maxPlayers: max,
    duration: 60,
    imageUrl: `${THUMB_BASE}/${raw.thumb}`,
    branchName: '제로월드 홍대점',
  };
};

export const toTimeSlot = (
  themeId: string,
  date: string,
  raw: ZerohongdaeRawTime,
): TimeSlot => ({
  themeId,
  datetime: `${date}T${raw.time.slice(0, 5)}:00`, // "14:00:00" → "2026-04-05T14:00:00"
  available: !raw.reservation, // reservation=true → 예약됨(빈자리X), false → 빈자리
});

export const toBookingPayload = (
  request: BookingRequest,
): ZerohongdaeBookingPayload => {
  const themePK = Number(request.themeId.split(':')[1]);
  const [date, timePart] = request.startDateTime.split('T');
  const time = timePart.slice(0, 5);

  return {
    reservationDate: date,
    reservationTime: `${time}:00`,
    themePK,
    name: request.userInfo.name,
    phone: request.userInfo.phone,
    people: request.playerCount,
    paymentType: 1,
  };
};

export const toBookingResult = (
  raw: ZerohongdaeBookingResponse,
): BookingResult => ({
  status: raw.success ? 'success' : 'failed',
  message: raw.message,
});

export { PROVIDER_ID };
