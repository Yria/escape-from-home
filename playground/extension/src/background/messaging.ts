import type { BookingTask } from '../core/types';
import type { EngineLog } from './booking-engine';

// Popup → Background 메시지 타입
export type PopupMessage =
  | { type: 'START_BOOKING'; tasks: BookingTask[] }
  | { type: 'CANCEL_TASK'; taskId: string }
  | { type: 'CANCEL_ALL' }
  | { type: 'GET_STATUS' }
  | { type: 'OPEN_BOOKING'; taskId: string; bookingUrl: string }
  | { type: 'ATTEMPT_SLOT_BOOKING'; taskId: string; slotId: string };

// Background → Popup 응답 타입
export type BackgroundResponse =
  | { type: 'STATUS_UPDATE'; tasks: BookingTask[]; logs: EngineLog[] }
  | { type: 'OK' }
  | { type: 'ERROR'; message: string };

// Popup에서 Background로 메시지 전송
export const sendToBackground = (
  message: PopupMessage,
): Promise<BackgroundResponse> =>
  chrome.runtime.sendMessage(message);

// Background에서 모든 Popup에 상태 브로드캐스트
export const broadcastStatus = (tasks: BookingTask[], logs: EngineLog[]) => {
  const message: BackgroundResponse = { type: 'STATUS_UPDATE', tasks, logs };
  chrome.runtime.sendMessage(message).catch(() => {
    // popup이 닫혀있으면 무시
  });
};
