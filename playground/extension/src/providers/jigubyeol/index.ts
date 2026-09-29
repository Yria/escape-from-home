import type { ProviderAdapter, ExecutionContext, ExecutionResult } from '../types';
import type { FoundSlot } from '../../core/types';
import {
  BASE_URL,
  BRANCHES,
  fetchReservationHtml,
  parseThemes,
  parseSlots,
} from './api';
import { toTheme, toTimeSlot, PROVIDER_ID } from './mapper';
import { buildReservationSteps } from './actions';

const listUrl = (branch: number, theme: number, date: string): string =>
  `${BASE_URL}/reservation?branch=${branch}&theme=${theme}&date=${date}#list`;

// 로컬 시간 기준 오늘 날짜 (execute()의 today 계산과 일관 — KST 새벽 UTC 오프셋 오차 방지)
const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const createJigubyeolProvider = (): ProviderAdapter => ({
  meta: {
    id: PROVIDER_ID,
    name: '지구별방탈출',
    websiteUrl: `${BASE_URL}/reservation`,
    requiredFields: ['name', 'phone'],
  },

  fetchThemes: async (date) => {
    const targetDate = date ?? todayStr();
    const branches = Object.keys(BRANCHES).map(Number);
    const perBranch = await Promise.all(
      branches.map(async (b) => {
        try {
          const html = await fetchReservationHtml(b, targetDate);
          return parseThemes(html, b);
        } catch {
          return [];
        }
      }),
    );
    return perBranch.flat().map(toTheme);
  },

  fetchTimeSlots: async (themeId, date) => {
    const [, branchStr, themeStr] = themeId.split(':');
    const html = await fetchReservationHtml(Number(branchStr), date, Number(themeStr));
    return parseSlots(html).map((raw) => toTimeSlot(themeId, date, raw));
  },

  execute: async (ctx: ExecutionContext): Promise<ExecutionResult> => {
    const { task, userInfo } = ctx;
    const [, branchStr, themeStr] = task.themeId.split(':');
    const branch = Number(branchStr);
    const theme = Number(themeStr);

    const startDate = task.startDateTime.split('T')[0];
    const startTime = task.startDateTime.slice(11, 16);
    const endDate = task.endDateTime.split('T')[0];
    const endTime = task.endDateTime.slice(11, 16);

    // 오늘 이후 날짜 범위 생성 (과거 날짜 제외)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = new Date(startDate + 'T00:00:00');
    const clampedStart = rangeStart < today ? today : rangeStart;

    const dates: string[] = [];
    const cur = new Date(clampedStart);
    const last = new Date(endDate + 'T00:00:00');
    while (cur <= last) {
      dates.push(
        `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
      );
      cur.setDate(cur.getDate() + 1);
    }

    const foundSlots: FoundSlot[] = [];
    let firstSteps: ReturnType<typeof buildReservationSteps> | undefined;
    let firstUrl = '';

    for (const date of dates) {
      const dayStart = date === startDate ? startTime : '00:00';
      const dayEnd = date === endDate ? endTime : '23:59';

      const html = await fetchReservationHtml(branch, date, theme);
      const slots = parseSlots(html); // 렌더 순서 보존

      slots.forEach((slot, idx) => {
        if (!slot.available) return;
        if (slot.time < dayStart || slot.time > dayEnd) return;

        foundSlots.push({
          id: `${date}T${slot.time}`,
          date,
          time: slot.time,
          hasApi: false,
          bookingUrl: listUrl(branch, theme, date),
        });

        // 첫 번째 빈자리 기준 autofill steps 저장 (nth-child: 1-based)
        if (!firstSteps) {
          firstUrl = listUrl(branch, theme, date);
          const steps = buildReservationSteps(idx + 1, task.playerCount, userInfo);
          steps[0].url = firstUrl;
          firstSteps = steps;
        }
      });
    }

    if (foundSlots.length === 0) {
      return { status: 'not_found', message: '빈자리 없음' };
    }

    return {
      status: 'found',
      message: `${foundSlots.length}개 빈자리 발견`,
      foundSlots,
      steps: firstSteps,
      notificationUrl: firstUrl || listUrl(branch, theme, startDate),
    };
  },
});
