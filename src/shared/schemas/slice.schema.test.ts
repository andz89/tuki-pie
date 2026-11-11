import { describe, expect, it } from 'vitest';
import { NewSlice, Slice } from './slice.schema';

const goodSlice = {
  id: 'vs-code',
  label: 'VS Code',
  type: 'app',
  path: 'C:\\Program Files\\VS Code\\Code.exe',
  position: 0,
};

describe('Slice schema', () => {
  it('accepts a valid slice', () => {
    expect(Slice.parse(goodSlice)).toEqual(goodSlice);
  });

  it('rejects a type other than app, folder, or note', () => {
    expect(Slice.safeParse({ ...goodSlice, type: 'website' }).success).toBe(
      false,
    );
  });

  it('rejects an empty label', () => {
    expect(Slice.safeParse({ ...goodSlice, label: '' }).success).toBe(false);
  });

  it('rejects a label longer than 24 characters', () => {
    expect(
      Slice.safeParse({ ...goodSlice, label: 'x'.repeat(25) }).success,
    ).toBe(false);
  });

  it('rejects a position past the eighth slice', () => {
    expect(Slice.safeParse({ ...goodSlice, position: 8 }).success).toBe(false);
  });
});

describe('NewSlice schema', () => {
  it('does not need an id or a position', () => {
    const { id: _id, position: _position, ...newSlice } = goodSlice;
    expect(NewSlice.safeParse(newSlice).success).toBe(true);
  });
});
