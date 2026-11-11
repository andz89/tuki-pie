// The order and open or closed state of the Page Info cards. It is a
// per-window convenience, so it lives in this window's local storage.

export const CARD_IDS = [
  'issues',
  'details',
  'seo',
  'tracking',
  'social',
  'comments',
] as const;

export type CardId = (typeof CARD_IDS)[number];

export interface CardLayout {
  order: CardId[];
  collapsed: CardId[];
}

const STORAGE_KEY = 'page-info-layout';

function isCardId(value: unknown): value is CardId {
  return (CARD_IDS as readonly unknown[]).includes(value);
}

// Keeps known cards once each, in the saved order, and adds any new cards
// at the end so an old saved layout never hides a card.
export function normalizeLayout(saved: unknown): CardLayout {
  const raw = (saved ?? {}) as Partial<Record<keyof CardLayout, unknown>>;
  const savedOrder = Array.isArray(raw.order) ? raw.order : [];
  const savedCollapsed = Array.isArray(raw.collapsed) ? raw.collapsed : [];

  const order = [...new Set(savedOrder.filter(isCardId))];
  for (const id of CARD_IDS) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }
  const collapsed = [...new Set(savedCollapsed.filter(isCardId))];
  return { order, collapsed };
}

export function moveCard(order: CardId[], from: CardId, to: CardId): CardId[] {
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return order;
  }
  const next = [...order];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, from);
  return next;
}

export function toggleCollapsed(collapsed: CardId[], id: CardId): CardId[] {
  return collapsed.includes(id)
    ? collapsed.filter((item) => item !== id)
    : [...collapsed, id];
}

export function loadLayout(): CardLayout {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    return normalizeLayout(text ? JSON.parse(text) : null);
  } catch {
    return normalizeLayout(null);
  }
}

export function saveLayout(layout: CardLayout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage can be blocked or full. The layout then lasts for this session.
  }
}
