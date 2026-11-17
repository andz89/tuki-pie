// Runs inside the website through chrome.scripting, right after
// vendor/mark.min.js, so it must stay one self-contained function. Both run
// in the extension's own copy of the page, which the website can't see.
// Marks every place the words appear in the page's text, after clearing the
// last marks. No words: only clears. Answers how many places were marked,
// or -1 when mark.js did not load.
export function highlightWordsOnPage(words) {
  const CLASS = 'pie-highlight';
  const STYLE_ID = 'pie-highlight-style';
  const CSS_TEXT = `
    mark.${CLASS} {
      background: #fde047 !important;
      color: #000 !important;
      border-radius: 2px !important;
      box-shadow: 0 0 0 1px #eab308 !important;
    }
  `;
  if (typeof window.Mark !== 'function') {
    return -1;
  }
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS_TEXT;
    document.documentElement.appendChild(style);
  }
  const marker = new window.Mark(document.body);
  return new Promise((resolve) => {
    marker.unmark({
      className: CLASS,
      done: () => {
        if (words.length === 0) {
          resolve(0);
          return;
        }
        let first = true;
        marker.mark(words, {
          className: CLASS,
          exclude: ['script', 'style', 'noscript', 'textarea', 'input'],
          each: (element) => {
            // The first place found comes into view.
            if (first) {
              first = false;
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          },
          done: (count) => resolve(count),
        });
      },
    });
  });
}
