import { createBookingEngine, handleBookingNotificationClick, openBookingWithAutofill, BOOKING_ALARM } from './booking-engine';
import { broadcastStatus } from './messaging';
import type { PopupMessage, BackgroundResponse } from './messaging';
import { getProvider } from '../providers/registry';
import { loadUserInfo, savePendingNotif } from '../storage';

const engine = createBookingEngine({
  retryIntervalMs: 10_000,
});

// SW 시작 시 저장된 태스크 복원
const initPromise = engine.restore();

// 아이콘 클릭 시 사이드 패널 열기 (팝업 대신)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// 상태 변경 시 popup에 브로드캐스트
engine.onStatusChange((tasks) => {
  broadcastStatus(tasks, engine.getLogs());
});

// 패널(사이드패널/팝업) 연결 감지
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'panel') return;
  // restore 완료 후 연결 처리 — running 상태 확정 전에 setPanelConnected 호출되면 타이머 누락
  initPromise.then(() => {
    engine.setPanelConnected(true);
  });
  port.onDisconnect.addListener(() => {
    engine.setPanelConnected(false);
  });
});

// 브라우저 재시작 시 복원 — alarm이 사라져도 재생성
chrome.runtime.onStartup.addListener(async () => {
  await initPromise;
  await engine.ensureAlarm();
});

// Alarm 핸들러 — SW가 죽었다 깨어나도 동작
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== BOOKING_ALARM) return;
  await initPromise;
  await engine.tickOnce();
});

// 알림 클릭 핸들러
chrome.notifications.onClicked.addListener((notifId) => {
  handleBookingNotificationClick(notifId);
});

// Popup으로부터 메시지 수신
chrome.runtime.onMessage.addListener(
  (
    message: PopupMessage,
    _sender,
    sendResponse: (response: BackgroundResponse) => void,
  ) => {
    const handle = async () => {
      await initPromise;

      switch (message.type) {
        case 'START_BOOKING':
          engine.enqueue(message.tasks);
          engine.start();
          sendResponse({ type: 'OK' });
          break;

        case 'CANCEL_TASK':
          engine.cancel(message.taskId);
          sendResponse({ type: 'OK' });
          break;

        case 'CANCEL_ALL':
          engine.cancelAll();
          engine.stop();
          sendResponse({ type: 'OK' });
          break;

        case 'GET_STATUS':
          sendResponse({ type: 'STATUS_UPDATE', tasks: engine.getTasks(), logs: engine.getLogs() });
          break;

        case 'OPEN_BOOKING':
          await openBookingWithAutofill(message.taskId, message.bookingUrl);
          sendResponse({ type: 'OK' });
          break;

        case 'ATTEMPT_SLOT_BOOKING': {
          const { taskId, slotId } = message;
          const task = engine.getTasks().find((t) => t.id === taskId);
          if (!task) {
            sendResponse({ type: 'ERROR', message: 'Task not found' });
            break;
          }
          const slot = task.foundSlots.find((s) => s.id === slotId);
          if (!slot) {
            sendResponse({ type: 'ERROR', message: 'Slot not found' });
            break;
          }

          const provider = getProvider(task.providerId);
          if (provider?.book) {
            const userInfo = await loadUserInfo();
            try {
              const result = await provider.book(task, slot, userInfo);
              if (result.status === 'booked') {
                chrome.notifications?.create(`${task.id}:booked`, {
                  type: 'basic',
                  iconUrl: 'icons/icon128.png',
                  title: '예약 성공!',
                  message: `${task.themeName} ${slot.date} ${slot.time} 예약 완료`,
                  priority: 2,
                });
                sendResponse({ type: 'OK' });
              } else {
                // API 예약 실패 → fallback autofill
                if (result.actions || result.steps) {
                  await savePendingNotif(`${taskId}:${slotId}`, {
                    steps: result.steps,
                    actions: result.actions,
                    url: slot.bookingUrl ?? result.notificationUrl,
                  });
                }
                await openBookingWithAutofill(`${taskId}:${slotId}`, slot.bookingUrl);
                sendResponse({ type: 'OK' });
              }
            } catch {
              // book() 예외 → fallback autofill
              await openBookingWithAutofill(`${taskId}:${slotId}`, slot.bookingUrl);
              sendResponse({ type: 'OK' });
            }
          } else {
            // book() 없음 → autofill로 직접 예약
            await openBookingWithAutofill(`${taskId}:${slotId}`, slot.bookingUrl);
            sendResponse({ type: 'OK' });
          }
          break;
        }

        default:
          sendResponse({ type: 'ERROR', message: 'Unknown message type' });
      }
    };

    handle();
    return true; // async response
  },
);
