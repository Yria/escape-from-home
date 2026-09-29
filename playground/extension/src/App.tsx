import { useState, useEffect } from 'react';
import type { BookingTask } from './core/types';
import { MainPage } from './popup/pages/MainPage';
import { SettingsPage } from './popup/pages/SettingsPage';
import { MonitoringPage } from './popup/pages/MonitoringPage';
import { useUserSettings } from './popup/hooks/useUserSettings';
import { useBookingEngine } from './popup/hooks/useBookingEngine';
import { useProviders } from './popup/hooks/useProviders';

type Page = 'main' | 'settings' | 'monitoring';

function App() {
  const [page, setPage] = useState<Page | null>(null);
  const { userInfo, loading, save } = useUserSettings();
  const { tasks, logs, startBooking, cancelAll } = useBookingEngine();
  const { themes } = useProviders();

  // 로딩 완료 후 초기 페이지 결정: 기본정보 미입력 시 설정 페이지
  useEffect(() => {
    if (loading) return;
    if (page !== null) return;
    if (!userInfo || !userInfo.name || !userInfo.phone) {
      setPage('settings');
    } else {
      setPage('main');
    }
  }, [loading, userInfo, page]);

  // 활성 태스크가 있으면 모니터링 페이지로 전환
  useEffect(() => {
    const hasActive = tasks.some(
      (t) => t.status === 'pending' || t.status === 'attempting',
    );
    if (hasActive && page === 'main') {
      setPage('monitoring');
    }
  }, [tasks]);

  if (page === null) return null;

  const handleStartBooking = (newTasks: BookingTask[]) => {
    startBooking(newTasks);
  };

  switch (page) {
    case 'main':
      return (
        <MainPage
          themes={themes}
          activeTasks={tasks}
          onNavigate={setPage}
          onStartBooking={handleStartBooking}
        />
      );
    case 'settings':
      return (
        <SettingsPage
          userInfo={userInfo}
          onSave={save}
          onBack={() => {
            const hasActive = tasks.some(
              (t) => t.status === 'pending' || t.status === 'attempting',
            );
            setPage(hasActive ? 'monitoring' : 'main');
          }}
        />
      );
    case 'monitoring':
      return (
        <MonitoringPage
          tasks={tasks}
          logs={logs}
          onNavigate={setPage}
          onCancel={() => {
            cancelAll();
            setPage('main');
          }}
        />
      );
  }
}

export default App;
