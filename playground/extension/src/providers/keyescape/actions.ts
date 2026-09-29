import type { PageAction, PageActionStep } from '../../core/autofill';
import type { UserInfo } from '../../core/types';

/**
 * KeyEscape 예약 페이지 자동화 스텝을 조립한다.
 *
 * Step 1: reservation1.php — 날짜/시간 선택 → 폼 제출
 * Step 2: reservation2.php — 개인정보 입력 (reCAPTCHA/최종제출은 사용자)
 */
export const buildReservationSteps = (
  _zizumNum: number,
  date: string,
  timeNum: string,
  playerCount: number,
  userInfo: UserInfo | null,
): PageActionStep[] => {
  const step1Actions: PageAction[] = [
    // 날짜 선택 — 커스텀 datepicker에서 해당 일자 클릭
    { type: 'wait', selector: 'td.selDate.available' },
    { type: 'delay', ms: 500 },
    { type: 'click', selector: `td.selDate.available[data-date="${date}"]` },
    { type: 'delay', ms: 800 },

    // 시간 선택 — 라디오 버튼
    { type: 'wait', selector: `input.selThemeTimeNum[value="${timeNum}"]` },
    { type: 'check', selector: `input.selThemeTimeNum[value="${timeNum}"]` },
    { type: 'delay', ms: 300 },

    // 폼 제출 (다음 단계로 이동)
    { type: 'click', selector: '.btn_next_step' },
  ];

  const step2Actions: PageAction[] = [
    // reservation2.php 로드 대기
    { type: 'wait', selector: '#person' },

    // 인원 선택
    { type: 'select', selector: '#person', value: String(playerCount) },
    { type: 'delay', ms: 300 },
  ];

  // 개인정보 입력
  if (userInfo?.name) {
    step2Actions.push({
      type: 'fill',
      selectors: ['input[name="name"]'],
      value: userInfo.name,
    });
  }

  if (userInfo?.phone) {
    // 전화번호를 mobile2, mobile3 필드에 분리 입력
    // 010-1234-5678 → mobile2=1234, mobile3=5678
    const digits = userInfo.phone.replace(/\D/g, '');
    if (digits.length === 11) {
      step2Actions.push(
        { type: 'fill', selectors: ['input[name="mobile2"]'], value: digits.slice(3, 7) },
        { type: 'fill', selectors: ['input[name="mobile3"]'], value: digits.slice(7, 11) },
      );
    }
  }

  // 동의 체크박스
  step2Actions.push(
    { type: 'check', selector: 'input[name="agree_1"]' },
    { type: 'check', selector: 'input[name="agree_2"]' },
  );

  // reCAPTCHA 체크 및 최종 제출은 사용자가 직접 수행

  return [
    {
      actions: step1Actions,
    },
    {
      actions: step2Actions,
    },
  ];
};

/**
 * reservation1.php의 전체 URL을 생성한다.
 * execute()에서 notificationUrl로 사용.
 */
export const getReservationUrl = (
  zizumNum: number,
  themeNum: number,
  infoNum: number,
): string =>
  `https://www.keyescape.com/reservation1.php?zizum_num=${zizumNum}&theme_num=${themeNum}&theme_info_num=${infoNum}`;
