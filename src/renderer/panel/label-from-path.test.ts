import { describe, expect, it } from 'vitest';
import { labelFromPath } from './label-from-path';

describe('labelFromPath', () => {
  it('uses a folder name', () => {
    expect(labelFromPath('C:\\Users\\Me\\Downloads')).toBe('Downloads');
  });

  it('drops the file extension', () => {
    expect(labelFromPath('C:\\Notes\\ideas.txt')).toBe('ideas');
  });

  it('keeps earlier dots in a name', () => {
    expect(labelFromPath('C:\\Notes\\v1.2 plan.md')).toBe('v1.2 plan');
  });

  it('ignores a trailing slash', () => {
    expect(labelFromPath('C:\\Work\\')).toBe('Work');
  });

  it('copes with a whole drive', () => {
    expect(labelFromPath('D:\\')).toBe('D:');
  });

  it('fits the 24-character limit', () => {
    expect(labelFromPath(`C:\\${'x'.repeat(40)}`)).toHaveLength(24);
  });
});
