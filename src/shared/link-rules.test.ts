import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LINK_FILTER,
  LINK_RULES,
  canOpen,
  cleanWord,
  isBlocked,
  isMarked,
  readLinkFilter,
} from './link-rules';
import type { LinkFilter } from './link-rules';

const site = 'https://a.com';
const blocked = (path: string, filter: LinkFilter = DEFAULT_LINK_FILTER) =>
  isBlocked(site + path, filter);

describe('isBlocked with every rule on', () => {
  // The same cases as tuki's riskyUrl.test.js.
  it('hides links that change something or belong to a CMS backend', () => {
    for (const path of [
      '/posts/5/delete',
      '/delete-post/5',
      '/delete.php?id=5',
      '/item?action=trash&id=5',
      '/cart?remove_item=3',
      '/account/log-out',
      '/wp-login.php?action=logout',
      '/signout',
      '/newsletter/unsubscribe?u=1',
      '/api/destroy',
      '/admin',
      '/shop/admin/orders',
      '/administrator/index.php',
      '/wp-admin/post.php?post=1',
      '/posts/5/edit',
      '/page?action=edit',
      '/post?id=1&_wpnonce=abc',
      '/?p=12&preview=true',
      '/posts/5/DELETE',
      '/x%2Fdelete',
    ]) {
      expect(blocked(path), path).toBe(true);
    }
  });

  it('hides WordPress links that act without a nonce', () => {
    for (const path of [
      '/shop?add-to-cart=12',
      '/cart?undo_item=abc',
      '/shop?add_to_wishlist=12',
      '/account/deactivate',
      '/membership/cancel',
      '/newsletter/opt-out',
      '/?doing_wp_cron',
      '/wp-login.php',
      '/wp-login.php?action=lostpassword',
      '/?customize_theme=astra',
      '/?customize_changeset_uuid=1',
      '/about?elementor-preview=5',
      '/about?fl_builder',
      '/about?et_fb=1',
      '/about?ct_builder=true',
      '/about?brizy-edit',
      '/about?vc_editable=true',
    ]) {
      expect(blocked(path), path).toBe(true);
    }
  });

  it('keeps normal content links that only look like risky ones', () => {
    for (const path of [
      '/',
      '/blog/my-first-post',
      '/editorial/2026',
      '/edition-2026',
      '/editors-picks',
      '/admin-tips-for-teams',
      '/administration-guide',
      '/products?color=red',
      '/?p=12&preview=false',
      '/cancellation-policy',
      '/add-to-cart-guide',
      '/restore-your-energy',
    ]) {
      expect(blocked(path), path).toBe(false);
    }
  });

  it('keeps addresses it cannot read', () => {
    expect(isBlocked('not a url', DEFAULT_LINK_FILTER)).toBe(false);
  });
});

describe('HubSpot tracking keys', () => {
  it('stay listed and marked as carrying a token', () => {
    const href = `${site}/pt/about-us?__hstc=2216.fd5a&__hssc=2216.1.17&__hsfp=854b66b956464d5218d328131c2ce294`;
    expect(isBlocked(href, DEFAULT_LINK_FILTER)).toBe(false);
    expect(isMarked(href, DEFAULT_LINK_FILTER)).toBe(true);
  });
});

describe('isBlocked with rules switched off', () => {
  const without = (...off: string[]): LinkFilter => ({
    ...DEFAULT_LINK_FILTER,
    off,
  });

  it('shows links whose only rule is off', () => {
    expect(blocked('/posts/5/delete', without('action:delete'))).toBe(false);
    expect(blocked('/wp-admin/x', without('part:wp-admin'))).toBe(false);
    expect(blocked('/post?_wpnonce=a', without('nonce'))).toBe(false);
    expect(blocked('/?preview=true', without('preview'))).toBe(false);
    expect(blocked('/shop?add-to-cart=1', without('action:add-to-cart'))).toBe(
      false,
    );
  });

  it('still hides a link another rule matches', () => {
    expect(blocked('/wp-admin/delete', without('part:wp-admin'))).toBe(true);
  });

  it('shows everything with every rule off', () => {
    const allOff = without(...LINK_RULES.map(({ id }) => id));
    expect(blocked('/wp-admin/post.php?action=trash&_wpnonce=1', allOff)).toBe(
      false,
    );
  });
});

describe('your words', () => {
  const withWords = (
    ...words: { word: string; on: boolean }[]
  ): LinkFilter => ({
    ...DEFAULT_LINK_FILTER,
    words,
  });

  it('hides links with a word that is on', () => {
    const filter = withWords({ word: 'checkout', on: true });
    expect(blocked('/checkout', filter)).toBe(true);
    expect(blocked('/shop?checkout=1', filter)).toBe(true);
    expect(blocked('/go/checkout-now', filter)).toBe(true);
    expect(blocked('/checkouts', filter)).toBe(false);
  });

  it('matches a word with separators as one part', () => {
    const filter = withWords({ word: 'check-out', on: true });
    expect(blocked('/check_out', filter)).toBe(true);
  });

  it('ignores a word that is off', () => {
    expect(
      blocked('/checkout', withWords({ word: 'checkout', on: false })),
    ).toBe(false);
  });
});

describe('token marking', () => {
  it('marks token links only while it is on', () => {
    const href = `${site}/reset?token=abc`;
    expect(isMarked(href, DEFAULT_LINK_FILTER)).toBe(true);
    expect(isMarked(href, { ...DEFAULT_LINK_FILTER, tokens: false })).toBe(
      false,
    );
  });
});

describe('canOpen', () => {
  it('opens plain web links only', () => {
    expect(canOpen(`${site}/about`, DEFAULT_LINK_FILTER)).toBe(true);
    expect(canOpen('mailto:hi@a.com', DEFAULT_LINK_FILTER)).toBe(false);
    expect(canOpen(`${site}/posts/5/delete`, DEFAULT_LINK_FILTER)).toBe(false);
    expect(canOpen(`${site}/order?id=5`, DEFAULT_LINK_FILTER)).toBe(false);
  });

  it('opens a marked link the user ticked, never a hidden one', () => {
    expect(canOpen(`${site}/order?id=5`, DEFAULT_LINK_FILTER, true)).toBe(true);
    expect(canOpen(`${site}/posts/5/delete`, DEFAULT_LINK_FILTER, true)).toBe(
      false,
    );
  });

  it('follows the switches', () => {
    const open = { off: ['action:delete'], words: [], tokens: false };
    expect(canOpen(`${site}/posts/5/delete`, open)).toBe(true);
    expect(canOpen(`${site}/order?id=5`, open)).toBe(true);
  });
});

describe('readLinkFilter', () => {
  it('reads a saved filter', () => {
    const saved = {
      off: ['nonce'],
      words: [{ word: 'x', on: true }],
      tokens: false,
    };
    expect(readLinkFilter(JSON.stringify(saved))).toEqual(saved);
  });

  it('falls back to everything on', () => {
    expect(readLinkFilter('not json')).toEqual(DEFAULT_LINK_FILTER);
    expect(readLinkFilter('{"off":5}')).toEqual(DEFAULT_LINK_FILTER);
  });
});

describe('cleanWord', () => {
  it('trims and lowercases', () => {
    expect(cleanWord('  CheckOut ')).toBe('checkout');
  });

  it('refuses a word with nothing to match', () => {
    expect(cleanWord('   ')).toBeNull();
    expect(cleanWord('--')).toBeNull();
  });
});

describe('the rules', () => {
  it('have unique ids', () => {
    const ids = LINK_RULES.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
