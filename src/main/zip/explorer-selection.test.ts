import { describe, expect, it } from 'vitest';
import { parseSelection, selectionScript } from './explorer-selection';

describe('selectionScript', () => {
  it('looks for the window by its number', () => {
    const script = selectionScript({ id: 7214866n, title: 'Pics' });
    expect(script).toContain('[int64]$_.HWND -eq 7214866');
    expect(script).toContain('SelectedItems()');
  });

  it('passes the title as base64, so a folder name cannot break out', () => {
    const title = `Bob's "pics"; Remove-Item C:\\ -Recurse`;
    const script = selectionScript({ id: 1n, title });
    expect(script).not.toContain('Remove-Item');
    expect(script).toContain(Buffer.from(title, 'utf8').toString('base64'));
  });

  it('prints in UTF-8, so names in any language survive', () => {
    expect(selectionScript({ id: 1n, title: 'x' })).toContain(
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    );
  });
});

describe('parseSelection', () => {
  it('reads one path per line and drops blank lines', () => {
    expect(
      parseSelection('C:\\Pics\\photo 1.png\r\nC:\\Pics\\写真.jpg\r\n\r\n'),
    ).toEqual(['C:\\Pics\\photo 1.png', 'C:\\Pics\\写真.jpg']);
  });

  it('reads nothing from no output', () => {
    expect(parseSelection('')).toEqual([]);
  });
});
