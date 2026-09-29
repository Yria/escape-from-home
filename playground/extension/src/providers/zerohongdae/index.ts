import type { ProviderAdapter, ExecutionContext, ExecutionResult } from '../types';
import type { BookingTask, UserInfo, FoundSlot } from '../../core/types';
import { fetchSession, fetchThemesByDate, submitBooking } from './api';
import { toTheme, toTimeSlot } from './mapper';
import { buildReservationActions } from './actions';

export const STORE_ID = 60;
const RESERVATION_URL = `https://zerohongdae.com/reservation/${STORE_ID}`;

/** 숫자만 추출 후 010-1234-5678 형식으로 변환 */
const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return phone;
};

export const createZerohongdaeProvider = (): ProviderAdapter => ({
  meta: {
    id: 'zerohongdae',
    name: '제로월드 홍대점',
    websiteUrl: RESERVATION_URL,
    requiredFields: ['name', 'phone'],
  },

  fetchThemes: async (date) => {
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    const session = await fetchSession(STORE_ID);
    const { data, pricing } = await fetchThemesByDate(STORE_ID, targetDate, session);
    return data.map((raw) => toTheme(raw, pricing[String(raw.PK)]));
  },

  fetchTimeSlots: async (themeId, date) => {
    const session = await fetchSession(STORE_ID);
    const { times } = await fetchThemesByDate(STORE_ID, date, session);
    const externalId = themeId.split(':')[1];
    const rawTimes = times[externalId] ?? [];
    return rawTimes.map((raw) => toTimeSlot(themeId, date, raw));
  },

  execute: async (ctx: ExecutionContext): Promise<ExecutionResult> => {
    const { task, userInfo } = ctx;
    const themePK = task.themeId.split(':')[1];
    const startDate = task.startDateTime.split('T')[0];
    const startTime = task.startDateTime.slice(11, 16);
    const endDate = task.endDateTime.split('T')[0];
    const endTime = task.endDateTime.slice(11, 16);

    const session = await fetchSession(STORE_ID);

    // startDate ~ endDate 범위의 날짜 목록 생성 (과거 날짜 제외)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = new Date(startDate + 'T00:00:00');
    const clampedStart = rangeStart < today ? today : rangeStart;

    const dates: string[] = [];
    const cur = new Date(clampedStart);
    const last = new Date(endDate + 'T00:00:00');
    while (cur <= last) {
      dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
      cur.setDate(cur.getDate() + 1);
    }

    const foundSlots: FoundSlot[] = [];

    for (const date of dates) {
      const dayStart = date === startDate ? startTime : '00:00';
      const dayEnd = date === endDate ? endTime : '23:59';

      const { times } = await fetchThemesByDate(STORE_ID, date, session);
      const rawTimes = times[themePK] ?? [];
      const available = rawTimes.filter((t) => {
        if (t.reservation) return false;
        const timeHHMM = t.time.slice(0, 5);
        return timeHHMM >= dayStart && timeHHMM <= dayEnd;
      });

      for (const slot of available) {
        const timeHHMM = slot.time.slice(0, 5);
        foundSlots.push({
          id: `${date}T${timeHHMM}`,
          date,
          time: timeHHMM,
          hasApi: true,
          bookingUrl: RESERVATION_URL,
        });
      }
    }

    if (foundSlots.length === 0) {
      return { status: 'not_found', message: '빈자리 없음' };
    }

    // 첫 번째 슬롯 기준 autofill actions (API 실패 시 fallback용)
    const first = foundSlots[0];
    const slotTime = `${first.time}:00`;
    const actions = buildReservationActions(themePK, first.date, slotTime, task.playerCount, userInfo);

    return {
      status: 'found',
      message: `${foundSlots.length}개 빈자리 발견`,
      foundSlots,
      actions,
      notificationUrl: RESERVATION_URL,
    };
  },

  book: async (task: BookingTask, slot: FoundSlot, userInfo: UserInfo | null): Promise<ExecutionResult> => {
    const themePK = task.themeId.split(':')[1];
    const slotTime = `${slot.time}:00`;

    if (userInfo) {
      try {
        const session = await fetchSession(STORE_ID);
        const res = await submitBooking(STORE_ID, {
          themePK: Number(themePK),
          reservationTime: slotTime,
          reservationDate: slot.date,
          name: userInfo.name,
          phone: formatPhone(userInfo.phone),
          people: task.playerCount,
          paymentType: 1,
        }, session);

        if (res.success) {
          return { status: 'booked', message: res.message };
        }
      } catch {
        // API 예약 실패 → 폼 자동화 fallback
      }
    }

    // API 실패 또는 userInfo 없음 → 폼 자동화 액션 반환
    const actions = buildReservationActions(themePK, slot.date, slotTime, task.playerCount, userInfo);
    return {
      status: 'found',
      message: `${slot.date} ${slot.time} API 예약 실패, autofill 전환`,
      actions,
      notificationUrl: RESERVATION_URL,
    };
  },
});
