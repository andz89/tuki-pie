import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { PIE_SCALES } from '../shared/schemas/settings.schema';
import type { PiePhase } from '../shared/types';
import { bridge } from './api/bridge';
import { PieMenu } from './components/PieMenu';
import { usePieStore } from './stores/pie.store';
import { useSettingsStore } from './stores/settings.store';

export function App() {
  const theme = useSettingsStore((state) => state.theme);
  const accent = useSettingsStore((state) => state.accent);
  const size = useSettingsStore((state) => state.size);
  const pin = useSettingsStore((state) => state.pin);
  const loadSettings = useSettingsStore((state) => state.load);
  const loadPie = usePieStore((state) => state.load);
  const [phase, setPhase] = useState<PiePhase>();

  useEffect(() => bridge.window.onPhase(setPhase), []);

  // The donut gets focus every time it opens, so this picks up any changes.
  useEffect(() => {
    const refresh = () => {
      void loadPie();
      void loadSettings();
    };

    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [loadPie, loadSettings]);

  return (
    <div
      className="pie-root"
      data-theme={theme}
      data-phase={phase}
      data-pin={pin}
      style={
        {
          '--accent': accent,
          '--pie-scale': PIE_SCALES[size],
        } as CSSProperties
      }
    >
      <PieMenu />
    </div>
  );
}
