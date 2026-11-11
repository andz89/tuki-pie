import { usePieStore } from '../stores/pie.store';
import { PieOrbit } from './PieOrbit';
import { ZipNameBox } from './ZipNameBox';
import { centerContent } from './center-content';
import { RING_ITEMS, ZIP_INDEX, zipDescription } from './slice-display';

export function PieCenter() {
  const error = usePieStore((state) => state.error);
  const notice = usePieStore((state) => state.notice);
  const circleHint = usePieStore((state) => state.circleHint);
  const hoveredIndex = usePieStore((state) => state.hoveredIndex);
  const zipNaming = usePieStore((state) => state.zipNaming);
  const zipCount = usePieStore((state) => state.zipCount);
  const ringItem = hoveredIndex === null ? null : RING_ITEMS[hoveredIndex];
  // The Zip slice says how many images it would pack.
  const item =
    ringItem && hoveredIndex === ZIP_INDEX
      ? { ...ringItem, description: zipDescription(zipCount) }
      : ringItem;

  const { label, description, orbit } = centerContent({
    error,
    notice,
    circleHint,
    item,
  });

  return (
    <div className="pie-center">
      <PieOrbit level={zipNaming ? 'off' : orbit} />
      {error && (
        <div key={error} className="pie-center-error" role="alert">
          {error}
        </div>
      )}
      {!error && zipNaming && <ZipNameBox />}
      {!error && !zipNaming && label && (
        // The key replays the fade each time the text changes.
        <div key={`${label}|${description}`} className="pie-center-text">
          <div className="pie-center-label">{label}</div>
          {description && <div className="pie-center-type">{description}</div>}
        </div>
      )}
    </div>
  );
}
