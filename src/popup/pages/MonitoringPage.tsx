import { useState, useEffect } from 'react';
import { KeyRound, Settings, Calendar, Timer, Users } from 'lucide-react';
import type { BookingTask } from '../../core/types';
import type { EngineLog } from '../../background/booking-engine';
import { sendToBackground } from '../../background/messaging';
import { SlotItem } from '../components/SlotItem';

interface MonitoringPageProps {
  tasks: BookingTask[];
  logs: EngineLog[];
  onNavigate: (page: 'settings' | 'main') => void;
  onCancel: () => void;
}

const statusLabel = (task: BookingTask) => {
  switch (task.status) {
    case 'pending': return '감시 중';
    case 'attempting': return '예약 시도 중';
    case 'success': return '완료';
    case 'failed': return '실패';
    case 'cancelled': return '취소됨';
  }
};

export const MonitoringPage = ({ tasks, logs, onNavigate, onCancel }: MonitoringPageProps) => {
  const [elapsed, setElapsed] = useState(0);

  // 첫 번째 태스크의 startedAt 기준으로 경과 시간 계산
  const startedAt = tasks[0]?.startedAt;

  // Elapsed timer
  useEffect(() => {
    if (!startedAt) return;
    const origin = new Date(startedAt).getTime();
    setElapsed(Math.floor((Date.now() - origin) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - origin) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  const isRunning = tasks.some(
    (t) => t.status === 'pending' || t.status === 'attempting',
  );

  // Find first selected task for conditions display
  const firstTask = tasks[0];

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <KeyRound size={20} className="header-icon" />
          <span className="header-title">방탈출 예약봇</span>
        </div>
        <button className="header-action" onClick={() => onNavigate('settings')}>
          <Settings size={20} />
        </button>
      </div>
      <div className="divider" />

      {/* Status Banner */}
      {isRunning && (
        <>
          <div className="status-banner">
            <div className="pulse-frame">
              <div className="pulse-dot" />
              <span className="pulse-text">자동 예약 진행 중...</span>
            </div>
            <span className="elapsed-text">
              {min}분 {String(sec).padStart(2, '0')}초 경과
            </span>
          </div>
          <div className="divider" />
        </>
      )}

      {/* Booking Conditions */}
      {firstTask && (
        <>
          <div className="section" style={{ gap: 6 }}>
            <span className="section-title">예약 조건</span>
            <div className="cond-row">
              <Calendar size={14} className="cond-icon" />
              <span className="cond-text">
                {new Date(firstTask.startDateTime).toLocaleDateString('ko-KR', {
                  month: 'long', day: 'numeric', weekday: 'short',
                })}
                {' '}
                {firstTask.startDateTime.slice(11, 16)}
              </span>
            </div>
            <div className="cond-row">
              <Timer size={14} className="cond-icon" />
              <span className="cond-text mono">
                ~{' '}
                {new Date(firstTask.endDateTime).toLocaleDateString('ko-KR', {
                  month: 'long', day: 'numeric', weekday: 'short',
                })}
                {' '}
                {firstTask.endDateTime.slice(11, 16)}
              </span>
            </div>
            <div className="cond-row">
              <Users size={14} className="cond-icon" />
              <span className="cond-text">{firstTask.playerCount}명</span>
            </div>
          </div>
          <div className="divider" />
        </>
      )}

      {/* Target Themes */}
      <div className="section" style={{ gap: 10 }}>
        <span className="section-title">
          대상 테마 ({tasks.length}개)
        </span>
        {tasks.map((task) => (
          <div key={task.id} className="monitor-card-wrapper">
            <div className="monitor-card">
              {task.imageUrl ? (
                <img className="monitor-card-thumb" src={task.imageUrl} alt={task.themeName} />
              ) : (
                <div className="monitor-card-thumb" />
              )}
              <div className="monitor-card-info">
                <span className="monitor-card-name">{task.themeName}</span>
                <span className="monitor-card-provider">{task.providerId}</span>
              </div>
              <span
                className={`monitor-card-status ${task.status === 'success' ? 'success' : ''}`}
              >
                {statusLabel(task)}
              </span>
            </div>
            {task.foundSlots.length > 0 && (
              <div className="slot-list">
                {task.foundSlots.map((slot) => (
                  <SlotItem
                    key={slot.id}
                    slot={slot}
                    onClick={() => {
                      sendToBackground({ type: 'ATTEMPT_SLOT_BOOKING', taskId: task.id, slotId: slot.id });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="divider" />

      {/* Logs */}
      <div className="section" style={{ gap: 8 }}>
        <span className="section-title">최근 시도 로그</span>
        {logs.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
            아직 시도 로그가 없습니다
          </span>
        )}
        <div className="log-scroll">
          {logs.map((log, i) => (
            <div key={i} className="log-row">
              <span className="log-time">{log.time}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="divider" />

      {/* Stop Button */}
      <div className="bottom-bar">
        <button className="btn-secondary danger" onClick={onCancel}>
          예약 중지
        </button>
      </div>
    </div>
  );
};
