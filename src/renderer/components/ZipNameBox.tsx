import { useState } from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';
import { usePieStore } from '../stores/pie.store';

// Keeps clicks and drags in the box from closing or moving the donut.
const keepInside = (event: SyntheticEvent) => event.stopPropagation();

// The zip's name, typed in the middle of the donut. Enter saves, Esc goes back.
export function ZipNameBox() {
  const zipImages = usePieStore((state) => state.zipImages);
  const cancelZip = usePieStore((state) => state.cancelZip);
  const [name, setName] = useState('');

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void zipImages(name);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelZip();
    }
  };

  return (
    <div
      className="pie-zip-name"
      onClick={keepInside}
      onPointerDown={keepInside}
      onMouseDown={keepInside}
    >
      <label className="pie-zip-name-label" htmlFor="pie-zip-name">
        Name the zip
      </label>
      <input
        id="pie-zip-name"
        className="pie-zip-name-input"
        // The donut has the focus already, so typing can start right away.
        autoFocus
        maxLength={120}
        placeholder="Images"
        spellCheck={false}
        autoComplete="off"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="pie-zip-name-hint">Enter · Esc</div>
    </div>
  );
}
