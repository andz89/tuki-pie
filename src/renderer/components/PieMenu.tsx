import { usePieDrag } from '../hooks/usePieDrag';
import { usePieKeyboard } from '../hooks/usePieKeyboard';
import { usePieStore } from '../stores/pie.store';
import { PieCenter } from './PieCenter';
import { useEffect, useState } from 'react';
import type { ListSide } from '../../shared/types';
import { PieShortcutsList } from './PieShortcutsList';
import { PieSnippetsList } from './PieSnippetsList';
import { PieSlice } from './PieSlice';
import {
  OUTER_RADIUS,
  PIE_SIZE,
  roundedSectorPath,
  sliceAngles,
} from './pie-geometry';
import {
  APPS_INDEX,
  RING_ITEMS,
  SCREENSHOT_INDEX,
  SETTINGS_INDEX,
  SHORTCUTS_INDEX,
  SNIPPETS_INDEX,
  ZIP_INDEX,
} from './slice-display';

export function PieMenu() {
  const dismiss = usePieStore((state) => state.dismiss);
  const litIndex = usePieStore(
    (state) => state.hoveredIndex ?? state.openIndex,
  );
  const lockedIndex = usePieStore((state) => state.lockedIndex);
  const trackPointer = usePieStore((state) => state.trackPointer);
  const listSide = usePieStore((state) => state.listSide);
  const openIndex = usePieStore((state) => state.openIndex);
  const zipCount = usePieStore((state) => state.zipCount);
  const dragHandlers = usePieDrag();
  usePieKeyboard();

  // After the list closes, the window is still wide for a moment. Keeping the
  // layout until it shrinks stops the donut from jumping sideways.
  const [dockSide, setDockSide] = useState<ListSide | null>(null);
  useEffect(() => {
    if (listSide) {
      setDockSide(listSide);
      return;
    }
    const settle = () => {
      if (window.innerWidth <= window.innerHeight + 1) {
        setDockSide(null);
      }
    };
    settle();
    window.addEventListener('resize', settle);
    return () => window.removeEventListener('resize', settle);
  }, [listSide]);

  // Which way the mouse heads, so crossing a slice on the way to what is open
  // doesn't close it.
  useEffect(() => {
    const onMove = (event: MouseEvent) =>
      trackPointer({ x: event.clientX, y: event.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [trackPointer]);

  // A click reaches the backdrop only if it wasn't on a slice.
  return (
    <div
      className="pie-backdrop"
      data-dock={listSide ?? dockSide}
      onClick={dismiss}
    >
      <div className="pie-menu" {...dragHandlers}>
        <svg
          className="pie-ring"
          data-locked={lockedIndex !== null || undefined}
          role="menu"
          aria-label="Pie menu"
          width={PIE_SIZE}
          height={PIE_SIZE}
          viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
        >
          <defs>
            <linearGradient id="pie-accent-fill" x1="0" y1="0" x2="0" y2="1">
              <stop className="pie-accent-top" offset="0" />
              <stop className="pie-accent-bottom" offset="1" />
            </linearGradient>
          </defs>
          {/* Solid under the tiles and hub, so the desktop never shows through. */}
          <circle
            className="pie-ring-base"
            cx={PIE_SIZE / 2}
            cy={PIE_SIZE / 2}
            r={OUTER_RADIUS - 0.5}
          />
          {/* Under every tile, or the glow would land on only one neighbor. */}
          {RING_ITEMS.map(({ label }, index) => {
            const { start, end } = sliceAngles(index, RING_ITEMS.length);
            return (
              <path
                key={label}
                className={
                  index === litIndex
                    ? 'pie-slice-glow is-lit'
                    : 'pie-slice-glow'
                }
                d={roundedSectorPath(start, end)}
              />
            );
          })}
          {RING_ITEMS.map(({ label, description, icon }, index) => (
            <PieSlice
              key={label}
              index={index}
              count={RING_ITEMS.length}
              label={label}
              description={description}
              icon={icon}
              showsSettingsFan={index === SETTINGS_INDEX}
              showsScreenshotFan={index === SCREENSHOT_INDEX}
              showsAppsFan={index === APPS_INDEX}
              disabled={index === ZIP_INDEX && zipCount === 0}
            />
          ))}
        </svg>
        <PieCenter />
      </div>
      {listSide && openIndex === SHORTCUTS_INDEX && <PieShortcutsList />}
      {listSide && openIndex === SNIPPETS_INDEX && <PieSnippetsList />}
    </div>
  );
}
