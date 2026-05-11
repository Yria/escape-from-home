import type { ProviderAdapter, ExecutionContext, ExecutionResult } from '../types';
import type { FoundSlot } from '../../core/types';
import { fetchAllThemes, fetchTimeSlotsByTheme, fetchDoing } from './api';
import { toTheme, toTimeSlot, PROVIDER_ID } from './mapper';
import { buildReservationSteps, getReservationUrl } from './actions';

export const createKeyescapeProvider = (): ProviderAdapter => ({
  meta: {
    id: PROVIDER_ID,
    name: '키이스케이프',
    websiteUrl: 'https://www.keyescape.com/reservation.php',
    requiredFields: ['name', 'phone'],
  },

  fetchThemes: async () => {
    const raw = await fetchAllThemes();
    return raw.map(toTheme);
  },

  fetchTimeSlots: async (themeId, date) => {
    const parts = themeId.split(':');
    const zizumNum = Number(parts[1]);
    const themeNum = Number(parts[2]);

    const res = await fetchTimeSlotsByTheme(date, zizumNum, themeNum);
    if (!res.status || !res.data) return [];
    return res.data.map((raw) => toTimeSlot(themeId, date, raw));
  },

  execute: async (ctx: ExecutionContext): Promise<ExecutionResult> => {
    const { task, userInfo } = ctx;
    const parts = task.themeId.split(':');
    const zizumNum = Number(parts[1]);
    const themeNum = Number(parts[2]);
    const infoNum = Number(parts[3]);

    const startDate = task.startDateTime.split('T')[0];
    const startTime = task.startDateTime.slice(11, 16);
    const endDate = task.endDateTime.split('T')[0];
    const endTime = task.endDateTime.slice(11, 16);

    const reservationUrl = getReservationUrl(zizumNum, themeNum, infoNum);

    // 캘린더 예약 가능 범위 조회: today ~ today + (doing-1)
    const doing = await fetchDoing(zizumNum, themeNum, infoNum);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + doing - 1);

    // startDate ~ endDate를 캘린더 가능 범위로 클램프
    const rangeStart = new Date(startDate + 'T00:00:00');
    const rangeEnd = new Date(endDate + 'T00:00:00');
    const clampedStart = rangeStart < today ? today : rangeStart;
    const clampedEnd = rangeEnd > maxDate ? maxDate : rangeEnd;

    const dates: string[] = [];
    const cur = new Date(clampedStart);
    while (cur <= clampedEnd) {
      dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
      cur.setDate(cur.getDate() + 1);
    }

    const foundSlots: FoundSlot[] = [];
    let firstSteps: ReturnType<typeof buildReservationSteps> | null = null;

    for (const date of dates) {
      const dayStart = date === startDate ? startTime : '00:00';
      const dayEnd = date === endDate ? endTime : '23:59';

      const res = await fetchTimeSlotsByTheme(date, zizumNum, themeNum);
      if (!res.status || !res.data) continue;

      const available = res.data.filter((slot) => {
        if (slot.enable !== 'Y') return false;
        const hhmm = `${slot.hh.padStart(2, '0')}:${slot.mm.padStart(2, '0')}`;
        return hhmm >= dayStart && hhmm <= dayEnd;
      });

      for (const slot of available) {
        const hhmm = `${slot.hh.padStart(2, '0')}:${slot.mm.padStart(2, '0')}`;
        foundSlots.push({
          id: `${date}T${hhmm}`,
          date,
          time: hhmm,
          hasApi: false,
          bookingUrl: reservationUrl,
        });

        // 첫 번째 슬롯의 autofill steps 저장
        if (!firstSteps) {
          firstSteps = buildReservationSteps(
            zizumNum,
            date,
            String(slot.num),
            task.playerCount,
            userInfo,
          );
          firstSteps[0].url = reservationUrl;
        }
      }
    }

    if (foundSlots.length === 0) {
      return { status: 'not_found', message: '빈자리 없음' };
    }

    return {
      status: 'found',
      message: `${foundSlots.length}개 빈자리 발견`,
      foundSlots,
      steps: firstSteps ?? undefined,
      notificationUrl: reservationUrl,
    };
  },
});
