interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export const Toggle = ({ value, onChange }: ToggleProps) => (
  <button
    className={`toggle ${value ? 'on' : 'off'}`}
    onClick={() => onChange(!value)}
    type="button"
  >
    <div className="toggle-knob" />
  </button>
);
