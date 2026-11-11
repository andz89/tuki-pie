import { useEffect, useState } from 'react';
import { formatKeys, keysFromPress } from '../../shared/open-keys';
import { usePanelStore } from './panel.store';

// Shows the keys that open the donut, and records new ones.
export function OpenKeysField() {
  const openKeys = usePanelStore((state) => state.settings.openKeys);
  const updateSettings = usePanelStore((state) => state.updateSettings);
  const showError = usePanelStore((state) => state.showError);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        setRecording(false);
        return;
      }
      const result = keysFromPress(event);
      if (!result) {
        return;
      }
      setRecording(false);
      if (result.ok) {
        void updateSettings({ openKeys: result.keys });
      } else {
        showError(result.error);
      }
    };
    // Capture, so the tab bar's own keys don't react while recording.
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', () => setRecording(false), { once: true });
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording, updateSettings, showError]);

  return (
    <fieldset className="field">
      <legend>Open the donut with</legend>
      <div className="open-keys">
        <output className="open-keys-value" aria-live="polite">
          {recording
            ? 'Press the new keys… (Esc to cancel)'
            : formatKeys(openKeys)}
        </output>
        {!recording && (
          <button type="button" onClick={() => setRecording(true)}>
            {openKeys ? 'Change' : 'Set keys'}
          </button>
        )}
        {!recording && openKeys && (
          <button
            type="button"
            className="button-quiet"
            onClick={() => void updateSettings({ openKeys: '' })}
          >
            Turn off
          </button>
        )}
      </div>
      <p className="panel-hint">Ctrl + Shift + click always works too.</p>
    </fieldset>
  );
}
