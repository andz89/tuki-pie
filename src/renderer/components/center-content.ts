import type { CircleHint } from '../stores/pie.store';

interface CenterState {
  error: string | null;
  notice: string | null;
  circleHint: CircleHint | null;
  item: { label: string; description: string } | null;
}

export type OrbitLevel = 'full' | 'dim' | 'off';

// What the middle of the donut says, and how strong the swirl behind it is.
// An error is small text that must be read, so nothing moves behind it.
export function centerContent({
  error,
  notice,
  circleHint,
  item,
}: CenterState) {
  const label = notice ?? circleHint?.label ?? item?.label ?? null;
  const description = notice
    ? null
    : (circleHint?.value ?? item?.description ?? null);

  let orbit: OrbitLevel = label ? 'dim' : 'full';
  if (error) {
    orbit = 'off';
  }

  return { label, description, orbit };
}
