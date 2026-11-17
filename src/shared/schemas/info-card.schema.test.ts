import { describe, expect, it } from 'vitest';
import {
  InfoCardFields,
  fieldsFromSetting,
  fieldsToSetting,
} from './info-card.schema';

describe('Info Card fields setting', () => {
  it('accepts known groups, and none', () => {
    expect(InfoCardFields.safeParse('title,canonical,images').success).toBe(
      true,
    );
    expect(InfoCardFields.safeParse('').success).toBe(true);
  });

  it('rejects the old combined group, so it falls back to the default', () => {
    expect(InfoCardFields.safeParse('meta,counts').success).toBe(false);
  });

  it('rejects an unknown group', () => {
    expect(InfoCardFields.safeParse('title,cookies').success).toBe(false);
  });

  it('reads and writes the groups in card order', () => {
    expect(fieldsFromSetting('images,canonical,title')).toEqual([
      'title',
      'canonical',
      'images',
    ]);
    expect(fieldsToSetting(['tracking', 'canonical'])).toBe(
      'canonical,tracking',
    );
    expect(fieldsFromSetting('')).toEqual([]);
  });
});
