import { describe, expect, it } from 'vitest';
import { centerContent } from './center-content';

const nothing = { error: null, notice: null, circleHint: null, item: null };
const item = { label: 'Snippets', description: 'Saved text' };
const circleHint = { label: 'Theme', value: 'Dark' };

describe('centerContent', () => {
  it('runs the swirl at full strength when there is nothing to say', () => {
    expect(centerContent(nothing)).toEqual({
      label: null,
      description: null,
      orbit: 'full',
    });
  });

  it('shows the hovered slice over a dimmed swirl', () => {
    expect(centerContent({ ...nothing, item })).toEqual({
      label: 'Snippets',
      description: 'Saved text',
      orbit: 'dim',
    });
  });

  it('prefers a hovered circle over its slice', () => {
    expect(centerContent({ ...nothing, item, circleHint })).toEqual({
      label: 'Theme',
      description: 'Dark',
      orbit: 'dim',
    });
  });

  it('shows a notice by itself, over a dimmed swirl', () => {
    expect(
      centerContent({ ...nothing, item, circleHint, notice: 'Copied' }),
    ).toEqual({ label: 'Copied', description: null, orbit: 'dim' });
  });

  it('turns the swirl off behind an error', () => {
    expect(
      centerContent({ ...nothing, item, error: 'Could not open' }).orbit,
    ).toBe('off');
  });
});
