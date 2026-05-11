import type {
  ProviderMeta,
  Theme,
  TimeSlot,
  BookingTask,
  UserInfo,
  FoundSlot,
} from '../core/types';
import type { PageAction, PageActionStep } from '../core/autofill';

// === Execution ===

export interface ExecutionContext {
  task: BookingTask;
  userInfo: UserInfo | null;
  signal?: AbortSignal;
}

export type ExecutionResultStatus =
  | 'booked'       // API로 직접 예약 완료
  | 'found'        // 빈자리 발견 + 자동화 액션 제공 (엔진이 자동 처리)
  | 'not_found'    // 빈자리 없음 (재시도 대상)
  | 'failed';      // 복구 불가 실패

export interface ExecutionResult {
  status: ExecutionResultStatus;
  message?: string;
  confirmationId?: string;
  foundSlots?: FoundSlot[];
  actions?: PageAction[];
  steps?: PageActionStep[];
  notificationUrl?: string;
}

// === Provider Adapter ===

export interface ProviderAdapter {
  meta: ProviderMeta;
  fetchThemes: (date?: string) => Promise<Theme[]>;
  fetchTimeSlots: (themeId: string, date: string) => Promise<TimeSlot[]>;
  execute: (ctx: ExecutionContext) => Promise<ExecutionResult>;
  book?: (task: BookingTask, slot: FoundSlot, userInfo: UserInfo | null) => Promise<ExecutionResult>;
}
