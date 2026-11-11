import { describe, expect, it } from 'vitest';
import {
  CARD_IDS,
  moveCard,
  normalizeLayout,
  toggleCollapsed,
} from './page-info-layout';

describe('normalizeLayout', () => {
  it('uses the default order when nothing is saved', () => {
    expect(normalizeLayout(null)).toEqual({
      order: [...CARD_IDS],
      collapsed: [],
    });
  });

  it('keeps the saved order, drops unknown and repeated cards, adds missing ones', () => {
    const layout = normalizeLayout({
      order: ['seo', 'nope', 'issues', 'seo'],
      collapsed: ['details', 'nope', 'details'],
    });
    expect(layout.order).toEqual([
      'seo',
      'issues',
      'details',
      'tracking',
      'social',
      'comments',
    ]);
    expect(layout.collapsed).toEqual(['details']);
  });

  it('ignores a malformed value', () => {
    expect(normalizeLayout({ order: 'seo', collapsed: 3 }).order).toEqual([
      ...CARD_IDS,
    ]);
  });
});

describe('moveCard', () => {
  it('moves a card down to the target spot', () => {
    expect(moveCard(['issues', 'details', 'seo'], 'issues', 'seo')).toEqual([
      'details',
      'seo',
      'issues',
    ]);
  });

  it('moves a card up to the target spot', () => {
    expect(moveCard(['issues', 'details', 'seo'], 'seo', 'issues')).toEqual([
      'seo',
      'issues',
      'details',
    ]);
  });

  it('leaves the order alone for an unknown card', () => {
    const order: Parameters<typeof moveCard>[0] = ['issues', 'details'];
    expect(moveCard(order, 'seo', 'issues')).toBe(order);
  });
});

describe('toggleCollapsed', () => {
  it('adds and removes a card', () => {
    expect(toggleCollapsed([], 'seo')).toEqual(['seo']);
    expect(toggleCollapsed(['seo', 'issues'], 'seo')).toEqual(['issues']);
  });
});
