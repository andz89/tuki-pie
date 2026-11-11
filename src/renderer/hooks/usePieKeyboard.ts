import { useEffect } from 'react';
import { RING_ITEMS } from '../components/slice-display';
import { usePieStore } from '../stores/pie.store';

export function nextHoveredIndex(
  current: number | null,
  count: number,
  step: 1 | -1,
): number {
  if (current === null) {
    return step === 1 ? 0 : count - 1;
  }
  return (current + step + count) % count;
}

// Returns true when the key belongs to the donut.
export function handlePieKey(key: string): boolean {
  const {
    hoveredIndex,
    lockedIndex,
    zipNaming,
    setHovered,
    openRingItem,
    close,
    unlock,
  } = usePieStore.getState();

  // While the zip is being named, keys are typing.
  if (zipNaming) {
    return false;
  }

  const moveHighlight = (step: 1 | -1) => {
    setHovered(nextHoveredIndex(hoveredIndex, RING_ITEMS.length, step));
  };

  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      moveHighlight(1);
      return true;
    case 'ArrowLeft':
    case 'ArrowUp':
      moveHighlight(-1);
      return true;
    case 'Enter':
      if (hoveredIndex !== null) {
        openRingItem(hoveredIndex);
      }
      return true;
    // A locked slice unlocks first; the next Esc closes the donut.
    case 'Escape':
      if (lockedIndex !== null) {
        unlock();
      } else {
        close();
      }
      return true;
    default:
      return false;
  }
}

export function usePieKeyboard(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (handlePieKey(event.key)) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
