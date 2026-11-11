import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

// Taken from Tuki's useHighlightSearch: marks words in the results with the
// CSS Custom Highlight API. It never changes the DOM, so it can't fight React
// over the same nodes. Styled by ::highlight(page-info-search) in the CSS.

const HIGHLIGHT_NAME = 'page-info-search';
// Controls are not results.
const EXCLUDE = 'button, input, .no-highlight';
// Waits for typing and re-renders to settle before searching again.
const SETTLE_MS = 150;

// Every place `keyword` appears, ignoring case, in text not inside EXCLUDE.
export function findRanges(root: Node, keyword: string): Range[] {
  const needle = keyword.toLowerCase();
  if (!needle) {
    return [];
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(EXCLUDE)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });

  const ranges: Range[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.nodeValue ?? '').toLowerCase();
    for (
      let at = text.indexOf(needle);
      at !== -1;
      at = text.indexOf(needle, at + needle.length)
    ) {
      const range = new Range();
      range.setStart(node, at);
      range.setEnd(node, at + needle.length);
      ranges.push(range);
    }
  }
  return ranges;
}

// Highlights `query` inside the container and says how many matches there
// are. Runs again whenever the container's content changes.
export function useHighlightSearch(
  containerRef: RefObject<HTMLElement | null>,
  query: string,
): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const root = containerRef.current;
    const keyword = query.trim();
    if (!root || !keyword || !CSS.highlights) {
      CSS.highlights?.delete(HIGHLIGHT_NAME);
      setCount(0);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      // Text in a hidden tab or a collapsed card can't be seen, so it
      // doesn't count.
      const ranges = findRanges(root, keyword).filter(
        (range) => range.getClientRects().length > 0,
      );
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
      setCount(ranges.length);
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, SETTLE_MS);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      // Switching tabs or collapsing a card only flips `hidden`.
      attributes: true,
      attributeFilter: ['hidden'],
    });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      CSS.highlights.delete(HIGHLIGHT_NAME);
    };
  }, [containerRef, query]);

  return count;
}
