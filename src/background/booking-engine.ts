import type { BookingTask } from '../core/types';
import type { ExecutionContext, ExecutionResult } from '../providers/types';
import { getProvider } from '../providers/registry';
import { loadUserInfo, saveBookingTasks, loadBookingTasks, clearBookingTasks, savePendingNotif, loadPendingNotif } from '../storage';
import { openAndExecute, openAndExecuteSteps } from '../core/autofill';

const NOTIF_PREFIX = 'efh_booking_';
export const BOOKING_ALARM = 'efh-booking-tick';

export interface BookingEngineConfig {
  retryIntervalMs: number;
}

export interface EngineLog {
  time: string;
  message: string;
}

type StatusListener = (tasks: BookingTask[]) => void;

export interface BookingEngine {
  enqueue: (tasks: BookingTask[]) => void;
  start: () => void;
  stop: () => void;
  cancel: (taskId: string) => void;
  cancelAll: () => void;
  getTasks: () => BookingTask[];
  getLogs: () => EngineLog[];
  onStatusChange: (callback: StatusListener) => () => void;
  restore: () => Promise<void>;
  persist: () => Promise<void>;
  setPanelConnected: (connected: boolean) => void;
  tickOnce: () => Promise<void>;
  ensureAlarm: () => Promise<void>;
}

export const createBookingEngine = (
  config: BookingEngineConfig,
): BookingEngine => {
  let tasks: BookingTask[] = [];
  let logs: EngineLog[] = [];
  let listeners: StatusListener[] = [];
  let timerId: ReturnType<typeof setInterval> | null = null;
  let panelConnected = false;
  let running = false;

  const addLog = (message: string) => {
    const time = new Date().toTimeString().slice(0, 8);
    logs = [{ time, message }, ...logs.slice(0, 49)];
  };

  const hasPending = () =>
    tasks.some((t) => t.status === 'pending' || t.status === 'attempting');

  const persist = async () => {
    const active = tasks.filter(
      (t) => t.status === 'pending' || t.status === 'attempting',
    );
    if (active.length > 0) {
      await saveBookingTasks(active);
    } else {
      await clearBookingTasks();
    }
  };

  const stopTimer = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    chrome.alarms.clear(BOOKING_ALARM);
  };

  const notify = () => {
    const snapshot = [...tasks];
    listeners.forEach((cb) => cb(snapshot));
  };

  const updateTask = (
    taskId: string,
    patch: Partial<BookingTask>,
  ) => {
    tasks = tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t));
  };

  const retryOrFail = (task: BookingTask, message?: string) => {
    const current = tasks.find((t) => t.id === task.id)!;
    updateTask(task.id, {
      status: 'pending',
      retryCount: current.retryCount + 1,
      result: { status: 'failed', message: message ?? '재시도 실패' },
    });
  };

  const handleResult = async (task: BookingTask, result: ExecutionResult) => {
    switch (result.status) {
      case 'booked':
        updateTask(task.id, {
          status: 'success',
          result: { status: 'success', confirmationId: result.confirmationId, message: result.message },
        });
        addLog(`${task.themeName} 예약 성공!`);
        chrome.notifications?.create(`${NOTIF_PREFIX}${task.id}`, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '예약 성공!',
          message: `${task.themeName} 예약이 완료되었습니다.`,
          priority: 2,
        });
        break;

      case 'found': {
        const currentTask = tasks.find((t) => t.id === task.id)!;
        const isFirstFind = currentTask.foundSlots.length === 0;
        const newSlots = result.foundSlots ?? [];

        // 최신 스캔 결과로 교체 (예약된 슬롯은 자동 제거)
        updateTask(task.id, {
          status: 'pending',
          foundSlots: newSlots,
          bookingUrl: result.notificationUrl,
        });
        addLog(`${task.themeName} ${result.message ?? '빈자리 발견'}`);

        // 각 슬롯의 autofill 데이터를 PendingNotif에 저장
        for (const slot of newSlots) {
          await savePendingNotif(`${task.id}:${slot.id}`, {
            steps: result.steps,
            actions: result.actions,
            url: slot.bookingUrl ?? result.notificationUrl,
          });
        }

        // notification 클릭 호환: taskId 키로도 첫 번째 슬롯 autofill 데이터 저장
        if (isFirstFind && newSlots.length > 0) {
          await savePendingNotif(task.id, {
            steps: result.steps,
            actions: result.actions,
            url: newSlots[0].bookingUrl ?? result.notificationUrl,
          });
        }

        // 최초 발견 시에만 notification 생성
        if (isFirstFind && newSlots.length > 0) {
          const notifId = `${NOTIF_PREFIX}${task.id}`;
          chrome.notifications?.create(notifId, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: `${task.themeName} 빈자리 발견!`,
            message: `${result.message ?? '빈자리 발견'} — 클릭하면 예약 페이지로 이동합니다.`,
            priority: 2,
            requireInteraction: true,
          });
        }
        break;
      }

      case 'not_found':
        retryOrFail(task, result.message ?? '빈자리 없음');
        addLog(`${task.themeName} 예약 시도... ${result.message ?? '빈자리 없음'}`);
        break;

      case 'failed':
        updateTask(task.id, {
          status: 'failed',
          result: { status: 'failed', message: result.message },
        });
        addLog(`${task.themeName} 실패: ${result.message ?? '알 수 없는 오류'}`);
        break;
    }
  };

  const attemptBooking = async (task: BookingTask): Promise<void> => {
    const provider = getProvider(task.providerId);
    if (!provider) {
      updateTask(task.id, {
        status: 'failed',
        result: { status: 'failed', message: `Unknown provider: ${task.providerId}` },
      });
      return;
    }

    updateTask(task.id, {
      status: 'attempting',
      lastAttemptAt: new Date().toISOString(),
    });

    try {
      const userInfo = await loadUserInfo();
      const ctx: ExecutionContext = { task, userInfo };
      const result = await provider.execute(ctx);
      await handleResult(task, result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      retryOrFail(task, msg);
      addLog(`${task.themeName} 오류: ${msg}`);
    }
  };

  let ticking = false;

  const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      const pending = tasks.filter(
        (t) => t.status === 'pending',
      );
      if (pending.length === 0) return;

      await Promise.allSettled(pending.map(attemptBooking));
      notify();
    } finally {
      ticking = false;
    }
  };

  const startTimer = () => {
    if (!running) return;
    stopTimer();

    if (panelConnected) {
      tick();
      timerId = setInterval(tick, config.retryIntervalMs);
    } else {
      chrome.alarms.create(BOOKING_ALARM, { periodInMinutes: 0.5 });
      persist();
    }
  };

  return {
    enqueue: (newTasks) => {
      // 완료/취소/실패된 이전 태스크 정리 후 추가
      tasks = [
        ...tasks.filter((t) => t.status === 'pending' || t.status === 'attempting'),
        ...newTasks,
      ];
      logs = [];
      notify();
      persist();
    },

    start: () => {
      running = true;
      startTimer();
    },

    stop: () => {
      running = false;
      stopTimer();
      persist();
    },

    cancel: (taskId) => {
      updateTask(taskId, { status: 'cancelled' });
      notify();
      persist();
      if (!hasPending()) {
        running = false;
        stopTimer();
      }
    },

    cancelAll: () => {
      tasks = tasks.map((t) =>
        t.status === 'pending' || t.status === 'attempting'
          ? { ...t, status: 'cancelled' as const }
          : t,
      );
      running = false;
      stopTimer();
      notify();
      persist();
    },

    getTasks: () => [...tasks],

    getLogs: () => [...logs],

    onStatusChange: (cb) => {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    },

    restore: async () => {
      const saved = await loadBookingTasks();
      if (saved.length > 0) {
        // attempting 중에 SW가 죽었으면 pending으로 복원
        const restored = saved.map((t) =>
          t.status === 'attempting' ? { ...t, status: 'pending' as const } : t,
        );
        tasks = [...tasks, ...restored];
        running = true;
        startTimer();
        notify();
      }
    },

    persist,

    setPanelConnected: (connected: boolean) => {
      panelConnected = connected;
      if (running) {
        startTimer();
      }
    },

    tickOnce: async () => {
      await tick();
      await persist();
      if (!hasPending()) {
        running = false;
        stopTimer();
      }
    },

    ensureAlarm: async () => {
      if (!running || !hasPending()) return;
      if (panelConnected) return; // setInterval 모드면 불필요
      const existing = await chrome.alarms.get(BOOKING_ALARM);
      if (!existing) {
        chrome.alarms.create(BOOKING_ALARM, { periodInMinutes: 0.5 });
      }
    },
  };
};

// 노티 클릭 핸들러 (background/index.ts에서 등록)
// 클릭 시 새 탭에서 예약 페이지를 열고 autofill 실행
export const handleBookingNotificationClick = async (
  notificationId: string,
): Promise<void> => {
  if (!notificationId.startsWith(NOTIF_PREFIX)) return;
  chrome.notifications.clear(notificationId);

  const taskId = notificationId.slice(NOTIF_PREFIX.length);
  await openBookingWithAutofill(taskId);
};

// taskId로 저장된 autofill 데이터를 가져와 새 탭에서 실행
// fallbackUrl: autofill 데이터가 없을 때 단순 URL 열기용
export const openBookingWithAutofill = async (
  taskId: string,
  fallbackUrl?: string,
): Promise<void> => {
  const data = await loadPendingNotif(taskId);
  console.log('[EFH] openBookingWithAutofill', { taskId, hasData: !!data, steps: data?.steps?.length, actions: data?.actions?.length, url: data?.url, fallbackUrl });

  if (data?.steps && data.steps.length > 0) {
    console.log('[EFH] → openAndExecuteSteps', data.steps.length, 'steps');
    openAndExecuteSteps(data.steps);
  } else if (data?.actions && data?.url) {
    console.log('[EFH] → openAndExecute', data.url);
    openAndExecute(data.url, data.actions);
  } else if (data?.url) {
    console.log('[EFH] → fallback: open data.url');
    chrome.tabs.create({ url: data.url });
  } else if (fallbackUrl) {
    console.log('[EFH] → fallback: open fallbackUrl (no autofill data)');
    chrome.tabs.create({ url: fallbackUrl });
  }
};
