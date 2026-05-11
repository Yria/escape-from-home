import { ExternalLink } from 'lucide-react';
import type { FoundSlot } from '../../core/types';

interface SlotItemProps {
  slot: FoundSlot;
  onClick: () => void;
}

const formatDate = (dateStr: string): string => {
  const [, month, day] = dateStr.split('-');
  return `${month}/${day}`;
};

export const SlotItem = ({ slot, onClick }: SlotItemProps) => (
  <button className="slot-item" onClick={onClick}>
    <span className="slot-item-time">
      {formatDate(slot.date)} {slot.time}
    </span>
    {!slot.hasApi && <ExternalLink size={11} className="slot-item-icon" />}
  </button>
);
