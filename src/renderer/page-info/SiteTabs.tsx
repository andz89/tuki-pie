import { useEffect } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { PieIcon } from '../components/icons/SliceIcon';
import { usePageInfoStore } from './page-info.store';

// The tab next to the active one, going right (1) or left (-1), round.
export function nextTabId(
  ids: string[],
  activeId: string,
  step: 1 | -1,
): string | null {
  if (ids.length < 2) {
    return null;
  }
  const index = ids.indexOf(activeId);
  return ids[(index + step + ids.length) % ids.length];
}

// A middle click would start scrolling the strip instead.
const noAutoscroll = (event: MouseEvent) => {
  if (event.button === 1) {
    event.preventDefault();
  }
};

// Ctrl+T, Ctrl+W and Ctrl+Tab, as in a browser. Reads the store itself, so
// the one listener serves every render.
function onShortcut(event: globalThis.KeyboardEvent): void {
  if (!event.ctrlKey || event.altKey || event.metaKey) {
    return;
  }
  const { tabs, newTab, closeTab, switchTab } = usePageInfoStore.getState();
  const key = event.key.toLowerCase();
  if (key === 't' && !event.shiftKey) {
    event.preventDefault();
    void newTab(null);
  } else if (key === 'w' && !event.shiftKey && tabs.activeId) {
    event.preventDefault();
    void closeTab(tabs.activeId);
  } else if (key === 'tab') {
    event.preventDefault();
    const ids = tabs.tabs.map(({ id }) => id);
    const next = nextTabId(ids, tabs.activeId, event.shiftKey ? -1 : 1);
    if (next !== null) {
      void switchTab(next);
    }
  }
}

// One site per tab, like a browser. Each keeps its own results.
export function SiteTabs() {
  const { tabs, activeId } = usePageInfoStore((state) => state.tabs);
  const newTab = usePageInfoStore((state) => state.newTab);
  const closeTab = usePageInfoStore((state) => state.closeTab);
  const switchTab = usePageInfoStore((state) => state.switchTab);

  useEffect(() => {
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  // Arrow keys move between the tabs, as in any tab list.
  const onArrow = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    const ids = tabs.map(({ id }) => id);
    const next = nextTabId(ids, activeId, event.key === 'ArrowRight' ? 1 : -1);
    if (next !== null) {
      void switchTab(next);
      document.getElementById(`site-tab-${next}`)?.focus();
    }
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="site-tabs">
      <div
        className="site-tab-list"
        role="tablist"
        aria-label="Sites"
        onKeyDown={onArrow}
      >
        {tabs.map(({ id, title, address, status }) => (
          <div
            key={id}
            className={id === activeId ? 'site-tab is-active' : 'site-tab'}
            title={address ?? title}
          >
            <button
              type="button"
              role="tab"
              id={`site-tab-${id}`}
              aria-selected={id === activeId}
              tabIndex={id === activeId ? 0 : -1}
              className="site-tab-title"
              onClick={() => void switchTab(id)}
              onMouseDown={noAutoscroll}
              // A middle click closes it, as in a browser.
              onAuxClick={(event) => {
                if (event.button === 1) {
                  void closeTab(id);
                }
              }}
            >
              {status === 'checking' && (
                <span className="site-tab-busy" aria-label="Checking" />
              )}
              <span className="site-tab-text">{title}</span>
            </button>
            <button
              type="button"
              className="site-tab-close"
              aria-label={`Close ${title}`}
              title="Close tab (Ctrl+W)"
              onClick={() => void closeTab(id)}
            >
              <PieIcon type="close" size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="site-tab-new"
        aria-label="New tab"
        title="New tab (Ctrl+T)"
        onClick={() => void newTab(null)}
      >
        <PieIcon type="add" size={14} />
      </button>
    </div>
  );
}
