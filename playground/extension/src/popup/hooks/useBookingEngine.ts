import { useState, useEffect, useCallback } from 'react';
import type { BookingTask } from '../../core/types';
import type { EngineLog } from '../../background/booking-engine';
import { sendToBackground } from '../../background/messaging';

export const useBookingEngine = () => {
  const [tasks, setTasks] = useState<BookingTask[]>([]);
  const [logs, setLogs] = useState<EngineLog[]>([]);

  // Background에서 상태 업데이트 수신
  useEffect(() => {
    const handler = (message: { type: string; tasks?: BookingTask[]; logs?: EngineLog[] }) => {
      if (message.type === 'STATUS_UPDATE') {
        if (message.tasks) setTasks(message.tasks);
        if (message.logs) setLogs(message.logs);
      }
    };
    chrome.runtime.onMessage.addListener(handler);

    // 초기 상태 로드
    sendToBackground({ type: 'GET_STATUS' }).then((res) => {
      if (res.type === 'STATUS_UPDATE') {
        setTasks(res.tasks);
        setLogs(res.logs);
      }
    });

    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const startBooking = useCallback(async (newTasks: BookingTask[]) => {
    await sendToBackground({ type: 'START_BOOKING', tasks: newTasks });
  }, []);

  const cancelTask = useCallback(async (taskId: string) => {
    await sendToBackground({ type: 'CANCEL_TASK', taskId });
  }, []);

  const cancelAll = useCallback(async () => {
    await sendToBackground({ type: 'CANCEL_ALL' });
  }, []);

  return { tasks, logs, startBooking, cancelTask, cancelAll };
};
