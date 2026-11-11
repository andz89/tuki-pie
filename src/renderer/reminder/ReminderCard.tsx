import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { CSSProperties } from 'react';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type { DueReminder, ReminderBridge, Settings } from '../../shared/types';

declare global {
  interface Window {
    reminder: ReminderBridge;
  }
}

const bridge: ReminderBridge = window.reminder;

// Every due reminder, oldest first, each with its own buttons.
export function ReminderCard() {
  const [due, setDue] = useState<DueReminder[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // A clicked reminder hides at once, before main confirms.
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const cardRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const result = await bridge.list();
    if (result.ok) {
      setDue(result.value);
      setHandled(new Set());
    }
  }, []);

  useEffect(() => {
    void load();
    void bridge.settings.get().then((result) => {
      if (result.ok) {
        setSettings(result.value);
      }
    });
    return bridge.onUpdate(() => void load());
  }, [load]);

  const shown = due.filter(({ id }) => !handled.has(id));

  // The window fits the card, however many reminders it holds.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    const fit = () => void bridge.fit(Math.ceil(card.scrollHeight));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(card);
    return () => observer.disconnect();
  }, [shown.length]);

  const act = (id: string, action: (id: string) => Promise<unknown>) => {
    setHandled((current) => new Set(current).add(id));
    void action(id);
  };

  return (
    <div
      ref={cardRef}
      className="panel reminder-card"
      data-theme={settings.theme}
      style={{ '--accent': settings.accent } as CSSProperties}
    >
      {shown.map(({ id, title, preview }) => (
        <section key={id} className="reminder-item" aria-label={title}>
          <h2>🔔 {title}</h2>
          {preview && <p className="reminder-preview">{preview}</p>}
          <div className="reminder-buttons">
            <button
              type="button"
              className="button-primary"
              onClick={() => act(id, bridge.open)}
            >
              Open note
            </button>
            <button
              type="button"
              className="button"
              onClick={() => act(id, bridge.snooze)}
            >
              Snooze 10 min
            </button>
            <button
              type="button"
              className="button"
              onClick={() => act(id, bridge.done)}
            >
              Done
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
