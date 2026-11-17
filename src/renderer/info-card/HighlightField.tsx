import { useEffect, useRef, useState } from 'react';
import { PieIcon } from '../components/icons/SliceIcon';
import { infoCardBridge } from './info-card-bridge';

// Typing waits this long before the page is marked, so each key does not
// ask Chrome again.
export const HIGHLIGHT_WAIT_MS = 300;

// undefined: nothing asked. null: Chrome did not answer. A number: how many
// places on the page were marked.
type PageMarks = number | null | undefined;

// Marks the words on the page in Chrome while they are typed, again on each
// new page, and clears the marks when the field is emptied or the Links card
// closes.
function usePageHighlight(text: string, pageId: number): PageMarks {
  const [marks, setMarks] = useState<PageMarks>(undefined);
  // Whether the page may still carry marks from this card.
  const marked = useRef(false);

  useEffect(() => {
    const words = text.trim();
    if (words === '' && !marked.current) {
      setMarks(undefined);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const result = await infoCardBridge.highlight(words);
      marked.current = words !== '';
      if (live) {
        setMarks(words === '' ? undefined : result.ok ? result.value : null);
      }
    }, HIGHLIGHT_WAIT_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text, pageId]);

  useEffect(
    () => () => {
      if (marked.current) {
        void infoCardBridge.highlight('');
      }
    },
    [],
  );

  return marks;
}

// The page's answer, inside the field on the right.
function badge(marks: PageMarks): { text: string; found: boolean } | null {
  if (marks === undefined || marks === null) {
    return null;
  }
  return marks === 0
    ? { text: 'Not on page', found: false }
    : { text: `${marks} on page`, found: true };
}

// One field, two highlights: the words in the link addresses below, and the
// words in the page's text in Chrome (with mark.js).
export function HighlightField({
  text,
  pageId,
  onChange,
}: {
  text: string;
  pageId: number;
  onChange: (text: string) => void;
}) {
  const marks = usePageHighlight(text, pageId);
  const shown = badge(marks);
  return (
    <div className="links-highlight">
      <div className="links-field">
        <span className="links-field-icon is-highlight">
          <PieIcon type="edit" size={14} />
        </span>
        <input
          type="search"
          value={text}
          placeholder="Highlight words, in the list and on the page…"
          aria-label="Highlight words in the links and on the page"
          title="Marks these words in the link addresses below and in the page in Chrome"
          onChange={(event) => onChange(event.target.value)}
        />
        {shown && (
          <span
            className={
              shown.found ? 'links-field-badge is-found' : 'links-field-badge'
            }
            role="status"
          >
            {shown.text}
          </span>
        )}
      </div>
      {marks === null && (
        <p className="links-highlight-note" role="status">
          Couldn't mark the page in Chrome. If the Pie extension was just
          updated, reload it in chrome://extensions.
        </p>
      )}
    </div>
  );
}
