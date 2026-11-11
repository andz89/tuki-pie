import { z } from 'zod';
import { carriesToken } from './link-tokens';

// Links that may change something when visited (delete, log out, ...) or that
// only make sense in a CMS backend. Page Info hides links matching a rule that
// is switched on. Rules started from tuki's riskyUrl.js.
// See docs/superpowers/specs/2026-11-10-link-filters-design.md.

// action: matches as a word anywhere in a path segment or query key or value,
//   or as the whole part with separators removed ("opt-out" in "/opt-out").
// part: matches only a whole path segment or query key or value, so content
//   like "/editorial" or "/admin-tips" stays.
type RuleKind = 'action' | 'part' | 'nonce' | 'preview';

export interface LinkRule {
  id: string;
  label: string;
  group: RuleGroupId;
  kind: RuleKind;
}

export const RULE_GROUPS = [
  { id: 'changes', title: 'Change something when opened' },
  { id: 'wordpress', title: 'WordPress and WooCommerce' },
  { id: 'backend', title: 'CMS backend (whole part only)' },
  {
    id: 'builders',
    title: 'Theme customizer and page builders (whole part only)',
  },
  { id: 'actions', title: 'WordPress action links' },
] as const;

export type RuleGroupId = (typeof RULE_GROUPS)[number]['id'];

const words = (group: RuleGroupId, kind: RuleKind, labels: string[]) =>
  labels.map((label) => ({ id: `${kind}:${label}`, label, group, kind }));

export const LINK_RULES: LinkRule[] = [
  ...words('changes', 'action', [
    'delete',
    'remove',
    'trash',
    'destroy',
    'purge',
    'logout',
    'logoff',
    'signout',
    'unsubscribe',
  ]),
  // Links that act without a nonce.
  ...words('wordpress', 'action', [
    'add-to-cart',
    'undo_item',
    'add_to_wishlist',
    'deactivate',
    'cancel',
    'opt-out',
    'doing_wp_cron',
  ]),
  // Logout, lost password and reset links all go through it.
  ...words('wordpress', 'part', ['wp-login.php']),
  ...words('backend', 'part', ['admin', 'administrator', 'wp-admin', 'edit']),
  ...words('builders', 'part', [
    'customize_theme',
    'customize_changeset_uuid',
    'elementor-preview',
    'fl_builder',
    'et_fb',
    'ct_builder',
    'brizy-edit',
    'vc_editable',
  ]),
  {
    id: 'nonce',
    label: 'A key with "nonce" (_wpnonce)',
    group: 'actions',
    kind: 'nonce',
  },
  { id: 'preview', label: 'preview=true', group: 'actions', kind: 'preview' },
];

export const MAX_WORDS = 100;
export const MAX_WORD = 60;

export const LinkFilter = z.object({
  // Ids of built-in rules switched off. A rule added later starts on.
  off: z.array(z.string().max(100)).max(LINK_RULES.length + 50),
  words: z
    .array(z.object({ word: z.string().min(1).max(MAX_WORD), on: z.boolean() }))
    .max(MAX_WORDS),
  // Mark links that carry a token or an ID: listed, never opened.
  tokens: z.boolean(),
});
export type LinkFilter = z.infer<typeof LinkFilter>;

export const DEFAULT_LINK_FILTER: LinkFilter = {
  off: [],
  words: [],
  tokens: true,
};

// The setting is text. Anything unreadable means every rule is on.
export function readLinkFilter(text: string): LinkFilter {
  try {
    const parsed = LinkFilter.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : DEFAULT_LINK_FILTER;
  } catch {
    return DEFAULT_LINK_FILTER;
  }
}

// Trimmed and lowercased, or null when nothing is left to match.
export function cleanWord(word: string): string | null {
  const clean = word.trim().toLowerCase().slice(0, MAX_WORD);
  return joined(clean) === '' ? null : clean;
}

const splitWords = (part: string) =>
  part
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const joined = (part: string) => part.toLowerCase().replace(/[^a-z0-9]/g, '');

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function matchesAction(parts: string[], word: string): boolean {
  const target = joined(word);
  return parts.some(
    (part) => joined(part) === target || splitWords(part).includes(target),
  );
}

export function isBlocked(href: string, filter: LinkFilter): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  const query = [...url.searchParams];
  const parts = [
    ...url.pathname.split('/').filter(Boolean).map(safeDecode),
    ...query.flat(),
  ];
  const lowerParts = parts.map((part) => part.toLowerCase());
  const off = new Set(filter.off);

  const ruleHits = LINK_RULES.some((rule) => {
    if (off.has(rule.id)) {
      return false;
    }
    switch (rule.kind) {
      case 'action':
        return matchesAction(parts, rule.label);
      case 'part':
        return lowerParts.includes(rule.label);
      case 'nonce':
        return query.some(([key]) => key.toLowerCase().includes('nonce'));
      case 'preview':
        return url.searchParams.get('preview') === 'true';
    }
  });
  return (
    ruleHits ||
    filter.words.some(({ word, on }) => on && matchesAction(parts, word))
  );
}

// Whether a token or ID mark applies under this filter.
export function isMarked(href: string, filter: LinkFilter): boolean {
  return filter.tokens && carriesToken(href);
}

// What the app may open in Chrome: web links the filter doesn't hide. A marked
// link only when the user ticked it.
export function canOpen(
  href: string,
  filter: LinkFilter,
  ticked = false,
): boolean {
  return (
    /^https?:/i.test(href) &&
    !isBlocked(href, filter) &&
    (ticked || !isMarked(href, filter))
  );
}
