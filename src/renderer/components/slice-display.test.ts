import { describe, expect, it } from 'vitest';
import {
  APPS_INDEX,
  NOTES_INDEX,
  PAGE_INFO_INDEX,
  RING_ITEMS,
  SCREENSHOT_INDEX,
  SETTINGS_INDEX,
  SHORTCUTS_INDEX,
  SNIPPETS_INDEX,
  ZIP_INDEX,
  shortLabel,
  zipDescription,
} from './slice-display';

describe('shortLabel', () => {
  it('leaves a label that fits unchanged', () => {
    expect(shortLabel('Downloads')).toBe('Downloads');
  });

  it('cuts a long label to at most 11 characters with an ellipsis', () => {
    expect(shortLabel('Quarterly Budget Report')).toBe('Quarterly…');
  });

  it('leaves an 11-character label unchanged', () => {
    expect(shortLabel('Screenshots')).toBe('Screenshots');
  });
});

describe('RING_ITEMS', () => {
  it('lists the segments clockwise from the top', () => {
    expect(RING_ITEMS.map(({ label }) => label)).toEqual([
      'Screenshot',
      'Snippets',
      'Shortcuts',
      'Apps',
      'Web Page',
      'Notes',
      'Zip',
      'Settings',
    ]);
  });

  it('describes Web Page', () => {
    expect(RING_ITEMS[PAGE_INFO_INDEX]).toMatchObject({
      label: 'Web Page',
      description: 'Check a website',
    });
  });

  it('points the built-in indexes at the right segments', () => {
    expect(RING_ITEMS[SCREENSHOT_INDEX].label).toBe('Screenshot');
    expect(RING_ITEMS[SHORTCUTS_INDEX].label).toBe('Shortcuts');
    expect(RING_ITEMS[APPS_INDEX].label).toBe('Apps');
    expect(RING_ITEMS[SETTINGS_INDEX].label).toBe('Settings');
  });

  it('describes Notes', () => {
    expect(RING_ITEMS[NOTES_INDEX]).toMatchObject({
      label: 'Notes',
      description: 'Notes and reminders',
      icon: 'note',
    });
  });

  it('describes Snippets as saved text', () => {
    expect(RING_ITEMS[SNIPPETS_INDEX]).toMatchObject({
      label: 'Snippets',
      description: 'Saved text',
    });
  });
});

describe('the Zip slice', () => {
  it('sits before Settings', () => {
    expect(RING_ITEMS[ZIP_INDEX]).toMatchObject({ label: 'Zip', icon: 'zip' });
  });

  it('says what it would do', () => {
    expect(zipDescription(null)).toBe('Looking for images…');
    expect(zipDescription(0)).toBe('Select images in Explorer first');
    expect(zipDescription(1)).toBe('1 image into a zip');
    expect(zipDescription(4)).toBe('4 images into a zip');
  });
});
