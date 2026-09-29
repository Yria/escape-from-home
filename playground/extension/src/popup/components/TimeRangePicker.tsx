import { Clock, Info } from 'lucide-react';

interface TimeRangePickerProps {
  startTime: string;
  endTime: string;
  onStartChange: (time: string) => void;
  onEndChange: (time: string) => void;
}

const HOURS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 8; // 08:00 ~ 22:00
  return `${String(h).padStart(2, '0')}:00`;
});

export const TimeRangePicker = ({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
}: TimeRangePickerProps) => (
  <div className="field-group">
    <span className="field-label">시간대</span>
    <div className="time-range-row">
      <div className="time-select">
        <Clock size={16} color="var(--fg-muted)" />
        <select value={startTime} onChange={(e) => onStartChange(e.target.value)}>
          {HOURS.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </div>
      <span className="time-range-separator">~</span>
      <div className="time-select">
        <Clock size={16} color="var(--fg-muted)" />
        <select value={endTime} onChange={(e) => onEndChange(e.target.value)}>
          {HOURS.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </div>
    </div>
    <div className="hint-row">
      <Info size={12} />
      <span>해당 시간대의 모든 회차가 예약 대상에 포함됩니다</span>
    </div>
  </div>
);
