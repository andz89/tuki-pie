import { useEffect, useRef, useState } from 'react';
import { REPEATS, REPEAT_LABELS, quickPicks } from '../../shared/reminder-time';
import type { Repeat } from '../../shared/reminder-time';
import { toLocalInput } from './notes-view';

interface ReminderMenuProps {
  disabled: boolean;
  // Starts from the note's own repeat, when it has a reminder.
  repeat: Repeat;
  onPick: (at: Date, repeat: Repeat) => void;
}

// "Remind me": Tuki's quick picks, any date and time, and a repeat.
export function ReminderMenu({ disabled, repeat, onPick }: ReminderMenuProps) {
  const [open, setOpen] = useState(false);
  const [chosenRepeat, setChosenRepeat] = useState<Repeat>(repeat);
  const [custom, setCustom] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setChosenRepeat(repeat);
    // An hour from now is a sensible start for the date-and-time field.
    setCustom(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, repeat]);

  const pick = (at: Date) => {
    setOpen(false);
    onPick(at, chosenRepeat);
  };

  return (
    <div className="reminder-menu" ref={menuRef}>
      <button
        type="button"
        className="button"
        disabled={disabled}
        aria-expanded={open}
        title={disabled ? 'Write something first' : 'Set a reminder'}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        🔔 Remind me
      </button>
      {open && (
        <div className="reminder-popover" role="dialog" aria-label="Remind me">
          <label className="reminder-repeat">
            Repeat
            <select
              value={chosenRepeat}
              onChange={(event) =>
                setChosenRepeat(event.target.value as Repeat)
              }
            >
              {REPEATS.map((value) => (
                <option key={value} value={value}>
                  {REPEAT_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <div className="reminder-picks">
            {quickPicks(new Date()).map(({ label, at }) => (
              <button
                key={label}
                type="button"
                className="reminder-pick"
                onClick={() => pick(at)}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            className="reminder-custom"
            onSubmit={(event) => {
              event.preventDefault();
              const at = new Date(custom);
              if (!Number.isNaN(at.getTime())) {
                pick(at);
              }
            }}
          >
            <input
              type="datetime-local"
              aria-label="Date and time"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
            />
            <button type="submit" className="button-primary" disabled={!custom}>
              Set
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
