import type { CSSProperties } from 'react';
import { ACCENT_PRESETS } from '../../shared/schemas/settings.schema';
import type { Pin, PieSize } from '../../shared/schemas/settings.schema';
import type { Theme } from '../../shared/types';
import { OpenKeysField } from './OpenKeysField';
import { usePanelStore } from './panel.store';

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const SIZES: Array<{ value: PieSize; label: string }> = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const PINS: Array<{ value: Pin; label: string }> = [
  { value: 'unpinned', label: 'Unpinned' },
  { value: 'pinned', label: 'Pinned' },
];

export function AppearanceSection() {
  const settings = usePanelStore((state) => state.settings);
  const updateSettings = usePanelStore((state) => state.updateSettings);
  const dragAccent = usePanelStore((state) => state.dragAccent);

  return (
    <section className="panel-section" aria-labelledby="appearance-heading">
      <div className="section-heading">
        <h2 id="appearance-heading">Appearance</h2>
      </div>

      <div className="appearance">
        <OpenKeysField />

        <fieldset className="field">
          <legend>Theme</legend>
          <div className="segmented">
            {THEMES.map(({ value, label }) => (
              <label key={value}>
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={settings.theme === value}
                  onChange={() => void updateSettings({ theme: value })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Donut size</legend>
          <div className="segmented">
            {SIZES.map(({ value, label }) => (
              <label key={value}>
                <input
                  type="radio"
                  name="size"
                  value={value}
                  checked={settings.size === value}
                  onChange={() => void updateSettings({ size: value })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Keep donut on top</legend>
          <div className="segmented">
            {PINS.map(({ value, label }) => (
              <label key={value}>
                <input
                  type="radio"
                  name="pin"
                  value={value}
                  checked={settings.pin === value}
                  onChange={() => void updateSettings({ pin: value })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Highlight color</legend>
          <div className="swatches">
            {ACCENT_PRESETS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="swatch"
                style={{ '--swatch': value } as CSSProperties}
                aria-label={label}
                aria-pressed={
                  settings.accent.toLowerCase() === value.toLowerCase()
                }
                onClick={() => void updateSettings({ accent: value })}
              />
            ))}
            <label className="swatch-custom">
              Custom
              <input
                type="color"
                value={settings.accent.toLowerCase()}
                onChange={(event) => dragAccent(event.target.value)}
              />
            </label>
          </div>
        </fieldset>
      </div>
    </section>
  );
}
