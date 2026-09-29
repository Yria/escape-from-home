import type { PageAction, PageActionStep } from '../../core/autofill';
import type { UserInfo } from '../../core/types';
import { formatPhone } from './mapper';

/**
 * 지구별방탈출 예약 자동화 스텝을 조립한다.
 *
 * Step 1: 리스트 페이지(/reservation?branch=&theme=&date=#list)
 *   - 대상 시간의 예약가능 버튼(.eveReservationButton) 클릭
 *   - reservation.js가 #eveSubmitForm을 채워 POST /reservation/create 로 이동
 * Step 2: 정보입력 페이지(/reservation/create)
 *   - 인원/이름/연락처/결제방식/약관 입력
 *   - 최종 제출(#eveReservationBtn)은 사용자가 직접 수행
 *
 * @param timeIndex .res-times 내 대상 시간 <li>의 1-based 위치 (렌더 순서 기준)
 */
export const buildReservationSteps = (
  timeIndex: number,
  playerCount: number,
  userInfo: UserInfo | null,
): PageActionStep[] => {
  // 예약가능 버튼만 매칭(.eveReservationButton) → 마감된 슬롯이면 클릭되지 않는다.
  const btnSelector = `.res-item .res-times > li:nth-child(${timeIndex}) button.eveReservationButton`;

  const step1: PageAction[] = [
    { type: 'wait', selector: btnSelector },
    { type: 'delay', ms: 400 }, // reservation.js click 핸들러 바인딩 대기
    { type: 'click', selector: btnSelector },
  ];

  const step2: PageAction[] = [
    // /reservation/create 로드 대기
    { type: 'wait', selector: 'input[name="name"]' },
    // 인원 선택 (option value=2/3/4)
    { type: 'select', selector: '#evePeople', value: String(playerCount) },
    { type: 'delay', ms: 200 },
  ];

  if (userInfo?.name) {
    step2.push({
      type: 'fill',
      selectors: ['input[name="name"]'],
      value: userInfo.name,
    });
  }
  if (userInfo?.phone) {
    step2.push({
      type: 'fill',
      selectors: ['input[name="phone"]'],
      value: formatPhone(userInfo.phone),
    });
  }

  // 결제방식(가상계좌) 선택 + 개인정보 처리방침 동의
  step2.push({ type: 'check', selector: 'input[name="payment_method"][value="21"]' });
  step2.push({ type: 'check', selector: 'input[name="policy"]' });

  return [{ actions: step1 }, { actions: step2 }];
};
