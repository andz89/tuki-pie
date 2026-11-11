// Runs inside the website through chrome.scripting, so it must stay one
// self-contained function: nothing from outside it is sent along.
// It finds links by the same rules as collect-page.js, so a link's position
// in Page Info's list is its position here.
export function showLinkOnPage(index, href) {
  const MAX_URL = 2048;
  const LINK_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:', 'sms:'];
  const STYLE_ID = 'pie-locate-style';
  const HIGHLIGHT = 'pie-locate-highlight';
  const LABEL = 'pie-locate-label';
  const CSS_TEXT = `
    .${HIGHLIGHT} {
      outline: 3px dashed #ef4444 !important;
      outline-offset: 2px !important;
      background-color: rgba(255, 255, 0, 0.2) !important;
      animation: pie-locate-pulse 1s infinite;
    }
    @keyframes pie-locate-pulse { 50% { outline-color: #f97316; } }
    .${LABEL} {
      position: absolute;
      z-index: 2147483647;
      padding: 4px 8px;
      background: #fcc600;
      color: #000;
      font: 12px/1.2 sans-serif;
      white-space: nowrap;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    }
  `;

  // These three are copies of collect-page.js; show-link-sync.test.ts keeps
  // them equal.
  const isText = (value) => typeof value === 'string' && value !== '';
  const isUsableUrl = (url) =>
    isText(url) && !url.startsWith('data:') && url.length <= MAX_URL;
  const isListedLink = (link) => {
    if (link.closest('#wpadminbar')) {
      return false;
    }
    const href = link.href;
    if (!isUsableUrl(href) || href.endsWith('/#')) {
      return false;
    }
    try {
      return LINK_PROTOCOLS.includes(new URL(href).protocol);
    } catch {
      return false;
    }
  };
  const hasBox = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const isShown = (link) => {
    const style = getComputedStyle(link);
    if (
      style.display !== 'contents' &&
      link.checkVisibility &&
      !link.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    ) {
      return false;
    }
    return hasBox(link) || [...link.children].some(hasBox);
  };

  // One link is marked at a time. The clear-up lives on the extension's own
  // copy of window, which the page can't see or call.
  window.__pieClearLocate?.();

  const links = [...document.querySelectorAll('a[href]')].filter(isListedLink);
  let link = links[index];
  // The page may have changed since it was read: then the same address is
  // the best match, a visible one first.
  if (!link || link.href !== href) {
    const matches = links.filter((item) => item.href === href);
    link = matches.find(isShown) ?? matches[0] ?? null;
  }
  if (!link) {
    return 'not-found';
  }
  if (!isShown(link)) {
    return 'hidden';
  }

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS_TEXT;
    document.documentElement.appendChild(style);
  }

  // A lone link is usually a small wrapper (an icon, an image), so its
  // parent makes a bigger marker.
  const parent = link.parentElement;
  const target = parent && parent.children.length === 1 ? parent : link;
  target.classList.add(HIGHLIGHT);

  // Placed in page coordinates, so it scrolls along with the link.
  const rect = target.getBoundingClientRect();
  const label = document.createElement('div');
  label.className = LABEL;
  label.textContent = "Here's the link";
  label.style.left = `${Math.max(0, rect.left + window.scrollX)}px`;
  label.style.top = `${rect.bottom + window.scrollY + 6}px`;
  document.documentElement.appendChild(label);

  link.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const clear = () => {
    target.classList.remove(HIGHLIGHT);
    label.remove();
    document.removeEventListener('pointerdown', clear, true);
    document.removeEventListener('keydown', onKey, true);
    window.__pieClearLocate = undefined;
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      clear();
    }
  };
  document.addEventListener('pointerdown', clear, true);
  document.addEventListener('keydown', onKey, true);
  window.__pieClearLocate = clear;
  return 'shown';
}
