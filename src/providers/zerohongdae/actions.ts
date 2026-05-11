import type { PageAction } from '../../core/autofill';
import type { UserInfo } from '../../core/types';

/**
 * zerohongdae 예약 페이지 자동화 액션 시퀀스를 조립한다.
 *
 * Step 1: 테마 라디오 선택 → 시간 라디오 선택 → NEXT 클릭
 * Step 2: 이름·전화번호 입력 → 동의 체크
 */
export const buildReservationActions = (
  themePK: string,
  date: string,
  time: string,
  playerCount: number,
  userInfo: UserInfo | null,
): PageAction[] => {
  // date: "2026-04-16" → year=2026, month=3 (0-indexed), day=16
  const [year, monthStr, dayStr] = date.split('-');
  const month = String(Number(monthStr) - 1);
  const day = String(Number(dayStr));

  const dateSelector =
    `.datepicker--cell-day[data-date="${day}"][data-month="${month}"][data-year="${year}"]`;

  const actions: PageAction[] = [
    // Step 0 — 날짜 선택
    { type: 'wait', selector: dateSelector },
    { type: 'click', selector: dateSelector },
    { type: 'delay', ms: 800 },

    // Step 1 — 테마 선택 (동적 로드 대기)
    { type: 'wait', selector: `#themeChoice input[value="${themePK}"]` },
    { type: 'check', selector: `#themeChoice input[value="${themePK}"]` },
    { type: 'delay', ms: 500 },

    // Step 1 — 시간 선택 (테마 선택 후 시간 목록 갱신 대기)
    { type: 'wait', selector: `#themeTimeWrap input[value="${time}"]` },
    { type: 'check', selector: `#themeTimeWrap input[value="${time}"]` },

    // Step 1 → Step 2 전환
    { type: 'click', selector: '#nextBtn' },
    { type: 'delay', ms: 800 },
  ];

  // Step 2 — 폼 채우기
  actions.push({ type: 'select', selector: '#step2PeopleWrap', value: String(playerCount) });

  if (userInfo?.name) {
    actions.push({ type: 'fill', selectors: ['input[name="name"]'], value: userInfo.name });
  }
  if (userInfo?.phone) {
    actions.push({ type: 'fill', selectors: ['input[name="phone"]'], value: userInfo.phone });
  }

  // 개인정보 동의 체크
  actions.push({ type: 'check', selector: 'input[name="policy"]' });

  return actions;
};
