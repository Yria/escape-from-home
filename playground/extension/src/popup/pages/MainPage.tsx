import { useState, useMemo } from 'react';
import { KeyRound, Settings, Search, Info, Users, ChevronRight } from 'lucide-react';
import type { Theme, BookingTask } from '../../core/types';
import { DatePicker } from '../components/DatePicker';
import { RoomCard } from '../components/RoomCard';

interface MainPageProps {
  themes: Theme[];
  activeTasks: BookingTask[];
  onNavigate: (page: 'settings' | 'monitoring') => void;
  onStartBooking: (tasks: BookingTask[]) => void;
}

export const MainPage = ({ themes, activeTasks, onNavigate, onStartBooking }: MainPageProps) => {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState(today);
  const [endTime, setEndTime] = useState('22:00');
  const [playerCount, setPlayerCount] = useState(4);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const runningTasks = activeTasks.filter(
    (t) => t.status === 'pending' || t.status === 'attempting',
  );

  const filteredThemes = useMemo(() => {
    if (!search) return themes;
    const q = search.toLowerCase();
    return themes.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.branchName?.toLowerCase().includes(q) ?? false),
    );
  }, [themes, search]);

  const toggleTheme = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStart = () => {
    const now = new Date().toISOString();
    const tasks: BookingTask[] = themes
      .filter((t) => selectedIds.has(t.id))
      .map((t) => ({
        id: `${t.id}:${Date.now()}`,
        providerId: t.providerId,
        themeId: t.id,
        themeName: t.name,
        imageUrl: t.imageUrl,
        startDateTime: `${startDate}T${startTime}:00`,
        endDateTime: `${endDate}T${endTime}:00`,
        playerCount,
        status: 'pending' as const,
        retryCount: 0,
        maxRetries: 30,
        startedAt: now,
        foundSlots: [],
      }));
    onStartBooking(tasks);
    onNavigate('monitoring');
  };

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

      {/* Active Booking Banner */}
      {runningTasks.length > 0 && (
        <>
          <div className="divider" />
          <button className="active-banner" onClick={() => onNavigate('monitoring')}>
            <div className="active-banner-left">
              <span className="pulse-dot" />
              <span className="active-banner-text">예약 진행 중</span>
              <span className="active-banner-sep">·</span>
              <span className="active-banner-sub">{runningTasks.length}개 테마 감시 중</span>
            </div>
            <ChevronRight size={16} className="active-banner-chevron" />
          </button>
        </>
      )}
      <div className="divider" />

      {/* Date & Time & Player Section */}
      <div className="section">
        <span className="section-title">예약 조건</span>
        <div className="field-group">
          <span className="field-label">시작</span>
          <div className="datetime-row">
            <DatePicker value={startDate} onChange={(d) => {
              setStartDate(d);
              if (d > endDate) setEndDate(d);
            }} />
            <select className="time-select-inline" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
              {Array.from({ length: 15 }, (_, i) => {
                const h = `${String(i + 8).padStart(2, '0')}:00`;
                return <option key={h} value={h}>{h}</option>;
              })}
            </select>
          </div>
        </div>
        <div className="field-group">
          <span className="field-label">종료</span>
          <div className="datetime-row">
            <DatePicker value={endDate} onChange={(d) => {
              if (d >= startDate) setEndDate(d);
            }} />
            <select className="time-select-inline" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
              {Array.from({ length: 15 }, (_, i) => {
                const h = `${String(i + 8).padStart(2, '0')}:00`;
                return <option key={h} value={h}>{h}</option>;
              })}
            </select>
          </div>
        </div>
        <div className="field-group">
          <span className="field-label">인원</span>
          <div className="player-field">
            <Users size={14} color="var(--fg-muted)" />
            <button
              className="player-btn"
              onClick={() => setPlayerCount(Math.max(1, playerCount - 1))}
            >
              −
            </button>
            <span className="player-value">{playerCount}명</span>
            <button
              className="player-btn"
              onClick={() => setPlayerCount(Math.min(10, playerCount + 1))}
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="divider" />

      {/* Room Section */}
      <div className="section" style={{ gap: 10 }}>
        <div className="room-header">
          <span className="section-title">방탈출 테마 선택</span>
          {selectedIds.size > 0 && (
            <span className="sel-count">{selectedIds.size}개 선택됨</span>
          )}
        </div>

        <div className="search-field">
          <Search size={16} color="var(--fg-muted)" />
          <input
            placeholder="테마 이름, 업체명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="room-list">
          {filteredThemes.map((theme) => (
            <RoomCard
              key={theme.id}
              theme={theme}
              selected={selectedIds.has(theme.id)}
              onToggle={toggleTheme}
            />
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bottom-bar">
        <button
          className="btn-primary"
          disabled={selectedIds.size === 0}
          onClick={handleStart}
        >
          자동 예약 시작
        </button>
        <div className="bottom-hint">
          <Info size={12} />
          <span>선택한 테마 중 빈 자리가 나오면 자동 예약합니다</span>
        </div>
      </div>
    </div>
  );
};
