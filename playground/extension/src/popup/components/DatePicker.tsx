import { Calendar } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
}

export const DatePicker = ({ value, onChange }: DatePickerProps) => {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="date-field">
      <Calendar size={16} color="var(--fg-muted)" />
      <input
        type="date"
        value={value}
        min={today}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
