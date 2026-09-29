import type { Theme, TimeSlot, BookingRequest } from '../../core/types';
import type { JigubyeolRawTheme, JigubyeolRawSlot, JigubyeolBookingPayload } from './api';
import { BRANCHES } from './api';

const PROVIDER_ID = 'jigubyeol';

/** 010-1234-5678 형식으로 정규화 (예약 폼의 mask-phone은 하이픈 포함 입력) */
export const formatPhone = (phone: string): string => {
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return phone;
};

export const toTheme = (raw: JigubyeolRawTheme): Theme => ({
  id: `${PROVIDER_ID}:${raw.branch}:${raw.id}`,
  providerId: PROVIDER_ID,
  name: raw.name,
  difficulty: raw.difficulty,
  genre: raw.genre,
  minPlayers: raw.minPlayers,
  maxPlayers: raw.maxPlayers,
  duration: raw.duration,
  imageUrl: raw.imageUrl,
  branchName: BRANCHES[raw.branch] ?? `지점${raw.branch}`,
});

export const toTimeSlot = (
  themeId: string,
  date: string,
  raw: JigubyeolRawSlot,
): TimeSlot => {
  const [h, m] = raw.time.split(':');
  return {
    themeId,
    datetime: `${date}T${h.padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}:00`,
    available: raw.available,
  };
};

/** 내부 BookingRequest → 외부 폼 페이로드 (themeId: "jigubyeol:{branch}:{theme}") */
export const toBookingPayload = (
  request: BookingRequest,
): JigubyeolBookingPayload => {
  const [, branchStr, themeStr] = request.themeId.split(':');
  const [date, timePart] = request.startDateTime.split('T');
  return {
    branch: Number(branchStr),
    theme: Number(themeStr),
    date,
    time: timePart.slice(0, 5),
    name: request.userInfo.name,
    phone: formatPhone(request.userInfo.phone),
    people: request.playerCount,
    paymentMethod: 21, // 가상계좌
  };
};

export { PROVIDER_ID };
