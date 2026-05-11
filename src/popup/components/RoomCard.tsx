import { Check } from 'lucide-react';
import type { Theme } from '../../core/types';

interface RoomCardProps {
  theme: Theme;
  selected: boolean;
  onToggle: (themeId: string) => void;
}

const difficultyStars = (level?: number) => {
  if (!level) return '';
  return '난이도 ' + '★'.repeat(level) + '☆'.repeat(5 - level);
};

export const RoomCard = ({ theme, selected, onToggle }: RoomCardProps) => (
  <div
    className={`room-card ${selected ? 'selected' : ''}`}
    onClick={() => onToggle(theme.id)}
  >
    {theme.imageUrl ? (
      <img className="room-card-thumb" src={theme.imageUrl} alt={theme.name} />
    ) : (
      <div className="room-card-thumb" />
    )}
    <div className="room-card-info">
      <span className="room-card-name">{theme.name}</span>
      <span className="room-card-provider">
        {theme.branchName}
      </span>
      <div className="room-card-tags">
        <span className="room-card-difficulty">
          {difficultyStars(theme.difficulty)}
        </span>
      </div>
    </div>
    <div className="room-card-check">
      {selected && <Check size={14} color="var(--fg-inverse)" />}
    </div>
  </div>
);
