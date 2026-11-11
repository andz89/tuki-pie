// The suggestions dropdown: clicking an input, text area or select on a page
// offers the values saved in Pie Launcher (Settings > Suggestions), under
// their group names. Loaded in every frame, because forms often sit in
// iframes. Content scripts can't be modules, so this file has no imports.
//   Shift+click several fields, then pick a value for all of them, or a
//   group's "Fill in order" to fill them in page order with its values.
//
// The values are the person's own (names, addresses): the list is drawn in a
// closed shadow root the page can't read, and only the person's own clicks
// and Tab presses open it, so a page script can't open it and read it.
//
// It reads `pieSuggestions` from chrome.storage.local, written by
// suggestions-store.js: { enabled, groups: [{ name, values: [{ value, label? }] }] }

(() => {
  const KEY = 'pieSuggestions';
  const SKIP_TYPES = new Set([
    'checkbox',
    'radio',
    'submit',
    'button',
    'reset',
    'file',
    'image',
    'color',
    'range',
    'hidden',
  ]);
  // Fields whose values are secrets the list must never offer to fill.
  const SECRET_AUTOCOMPLETE =
    /(^|\s)(one-time-code|current-password|new-password|cc-[a-z-]+)(\s|$)/;
  // A pick this soon after the list opens or moves can't be a real choice:
  // a page could slide the list under a click meant for something else.
  const PICK_DELAY_MS = 300;
  const BLUE = '#2563eb';
  const OFF = { enabled: false, groups: [] };

  const isList = (list) =>
    typeof list === 'object' &&
    list !== null &&
    typeof list.enabled === 'boolean' &&
    Array.isArray(list.groups) &&
    list.groups.every(
      (group) =>
        typeof group?.name === 'string' &&
        Array.isArray(group.values) &&
        group.values.every((item) => typeof item?.value === 'string'),
    );

  function start({
    storage,
    onChanged,
    isTrusted = (event) => event.isTrusted,
    shadowMode = 'closed',
    now = () => Date.now(),
    elementAt = (x, y) => document.elementFromPoint(x, y),
  }) {
    let settings = OFF;
    let active = null;
    // When the list last appeared or moved, see PICK_DELAY_MS.
    let shownAt = 0;
    let shownSpot = '';

    // Page styles can't reach inside the shadow root, but they can reach the
    // host. Inline !important beats any page rule, so it stays visible.
    const host = document.createElement('div');
    for (const [name, value] of [
      ['all', 'initial'],
      ['display', 'block'],
      ['opacity', '1'],
      ['visibility', 'visible'],
      ['filter', 'none'],
      ['transform', 'none'],
      ['clip-path', 'none'],
      ['mix-blend-mode', 'normal'],
    ]) {
      host.style.setProperty(name, value, 'important');
    }
    const box = document.createElement('div');
    box.setAttribute('role', 'listbox');
    host.attachShadow({ mode: shadowMode }).appendChild(box);
    Object.assign(box.style, {
      position: 'fixed',
      zIndex: '2147483647',
      background: 'white',
      border: '1px solid silver',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,.15)',
      padding: '4px',
      display: 'none',
      minWidth: '100px',
      maxHeight: '260px',
      overflowY: 'auto',
      fontFamily: 'Arial,sans-serif',
      color: '#222',
      textAlign: 'left',
    });

    const mount = () => {
      if (!host.isConnected && document.body) {
        document.body.appendChild(host);
      }
    };

    // Inside the list: events from its shadow root reach the page as the host.
    const inBox = (event) => event.composedPath().includes(host);

    // Whether the person can see the list as it is: nothing of the page on
    // top of it where they clicked, and neither it nor anything around it
    // made see-through or hidden. Checked before every pick, as a page can
    // change any of that while the list is open.
    function isShown(event) {
      const fromPointer = event.clientX !== 0 || event.clientY !== 0;
      if (fromPointer && elementAt(event.clientX, event.clientY) !== host) {
        return false;
      }
      for (let el = host; el; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (
          Number(style.opacity) < 1 ||
          style.visibility === 'hidden' ||
          style.display === 'none'
        ) {
          return false;
        }
      }
      return true;
    }

    const canPick = (event) =>
      isTrusted(event) && now() - shownAt >= PICK_DELAY_MS && isShown(event);

    // Sets the value the way typing would, so frameworks (React, Vue) see it.
    function setValue(el, value) {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : el instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      for (const type of ['input', 'change', 'blur']) {
        el.dispatchEvent(new Event(type, { bubbles: true }));
      }
    }

    function place() {
      if (!active) {
        return;
      }
      const rect = active.getBoundingClientRect();
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.bottom + 4}px`;
      box.style.width = `${Math.max(rect.width, 150)}px`;
      const spot = `${box.style.left},${box.style.top},${box.style.width}`;
      if (spot !== shownSpot) {
        shownSpot = spot;
        shownAt = now();
      }
    }

    function hide() {
      box.style.display = 'none';
      active = null;
    }

    // For a select, a suggestion matches an option by value or by the start
    // of its text ("06" picks "06-Jun").
    const matchOption = (select, text) =>
      Array.from(select.options).find(
        (option) =>
          option.value === text ||
          option.text.trim() === text ||
          option.text.trim().startsWith(text),
      );

    function selectItems(select, group) {
      const items = [];
      for (const { value, label } of group.values) {
        const option = matchOption(select, value);
        if (option && !items.some((item) => item.value === option.value)) {
          items.push({ text: option.text.trim(), value: option.value, label });
        }
      }
      return items;
    }

    // The groups to offer for these fields, each with what it offers.
    function groupItems(targets) {
      const selects = targets.every((t) => t instanceof HTMLSelectElement);
      return settings.groups
        .map((group) => ({
          group,
          items: selects
            ? selectItems(targets[0], group)
            : group.values.map(({ value, label }) => ({
                text: value,
                value,
                label,
              })),
        }))
        .filter(({ items }) => items.length > 0);
    }

    // Shift+click builds a selection of fields, outlined in blue.
    const selected = new Set();
    const oldOutline = new WeakMap();

    function toggleSelected(el) {
      if (selected.has(el)) {
        selected.delete(el);
        const [outline, offset] = oldOutline.get(el) ?? ['', ''];
        el.style.outline = outline;
        el.style.outlineOffset = offset;
      } else {
        selected.add(el);
        oldOutline.set(el, [el.style.outline, el.style.outlineOffset]);
        el.style.outline = `2px solid ${BLUE}`;
        el.style.outlineOffset = '1px';
      }
    }

    const clearSelected = () => [...selected].forEach(toggleSelected);

    function applyTo(el, value) {
      if (el instanceof HTMLSelectElement) {
        const option =
          Array.from(el.options).find((each) => each.value === value) ||
          matchOption(el, value);
        if (option) {
          setValue(el, option.value);
        }
      } else {
        setValue(el, value);
      }
    }

    // Runs once, on mousedown so focus stays in the field, or on click for
    // keyboards.
    function onChoose(el, run) {
      let done = false;
      const once = () => {
        if (!done) {
          done = true;
          run();
        }
      };
      el.addEventListener('mousedown', (event) => {
        event.preventDefault();
        if (canPick(event)) {
          once();
        }
      });
      el.addEventListener('click', (event) => {
        if (canPick(event)) {
          once();
        }
      });
    }

    function fillAll(targets, valueFor) {
      targets.forEach((target, index) => {
        try {
          applyTo(target, valueFor(index));
        } catch {
          // One field refusing the value doesn't stop the others.
        }
      });
      clearSelected();
      hide();
    }

    // Keeps focus in the field when the list is clicked.
    const keepFocus = (el) => {
      el.addEventListener('mousedown', (event) => event.preventDefault());
    };

    function addPart(kind, text, style) {
      const el = document.createElement('div');
      el.dataset.kind = kind;
      el.textContent = text;
      Object.assign(el.style, style);
      box.appendChild(el);
      return el;
    }

    function addShowAll(select) {
      const el = addPart('show-all', 'Show all…', {
        padding: '8px 10px',
        cursor: 'pointer',
        fontSize: '13px',
        color: BLUE,
        borderTop: '1px solid #eee',
        marginTop: '2px',
      });
      el.addEventListener('mousedown', (event) => {
        event.preventDefault();
        hide();
        select.focus();
        try {
          select.showPicker();
        } catch {
          // showPicker needs a user gesture and isn't in every browser.
        }
      });
    }

    function addHeading(group) {
      keepFocus(
        addPart('heading', group.name, {
          padding: '6px 10px 2px',
          fontSize: '11px',
          fontWeight: 'bold',
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: '.04em',
        }),
      );
    }

    function addHint(text) {
      keepFocus(
        addPart('hint', text, {
          padding: '2px 10px 4px',
          fontSize: '11px',
          color: '#888',
        }),
      );
    }

    // Fills the selected fields, top of the page first, with the group's
    // values in order.
    function addFillInOrder(targets, group) {
      const values = group.values;
      const ordered = [...targets].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
      const count = Math.min(ordered.length, values.length);
      const button = addPart('fill', `Fill in order (${count})`, {
        padding: '6px 10px',
        margin: '2px 2px 4px',
        fontSize: '13px',
        fontWeight: 'bold',
        color: 'white',
        background: BLUE,
        borderRadius: '4px',
        cursor: 'pointer',
        textAlign: 'center',
      });
      button.title = values
        .slice(0, count)
        .map(
          ({ value, label }, i) =>
            `${i + 1}. ${value}${label ? ` (${label})` : ''}`,
        )
        .join('\n');
      button.onmouseenter = () => (button.style.background = '#1d4ed8');
      button.onmouseleave = () => (button.style.background = BLUE);
      onChoose(button, () =>
        fillAll(ordered.slice(0, count), (i) => values[i].value),
      );
    }

    function addItem({ text, value, label }, input, targets, multi) {
      const current = !multi && String(input.value) === String(value);
      const background = current ? 'aliceblue' : 'white';
      const item = addPart('item', text, {
        padding: '8px 10px',
        cursor: 'pointer',
        fontSize: '14px',
        borderRadius: '4px',
        background,
        fontWeight: current ? 'bold' : 'normal',
      });
      item.dataset.value = value;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(current));
      if (label) {
        const note = document.createElement('span');
        note.textContent = label;
        Object.assign(note.style, {
          float: 'right',
          marginLeft: '10px',
          fontSize: '12px',
          color: '#999',
          fontWeight: 'normal',
        });
        item.appendChild(note);
      }
      item.onmouseenter = () => (item.style.background = 'whitesmoke');
      item.onmouseleave = () => (item.style.background = background);
      onChoose(item, () => {
        if (!multi && active) {
          active.focus();
        }
        fillAll(targets, () => value);
      });
    }

    function show(input) {
      const targets = selected.size ? [...selected] : [input];
      const multi = targets.length > 1;
      const groups = groupItems(targets);
      if (!groups.length) {
        hide();
        return;
      }
      mount();
      active = input;
      shownSpot = '';
      place();
      box.replaceChildren();
      if (multi) {
        addHint('Pick one value for all, or fill a group in order:');
      }
      for (const { group, items } of groups) {
        addHeading(group);
        if (multi) {
          addFillInOrder(targets, group);
        }
        for (const item of items) {
          addItem(item, input, targets, multi);
        }
      }
      if (!multi && input instanceof HTMLSelectElement) {
        addShowAll(input);
      }
      box.style.display = 'block';
    }

    function isTextField(el) {
      if (!el || el.disabled || el.readOnly) {
        return false;
      }
      const autocomplete = (
        el.getAttribute('autocomplete') ?? ''
      ).toLowerCase();
      if (el.type === 'password' || SECRET_AUTOCOMPLETE.test(autocomplete)) {
        return false;
      }
      if (el instanceof HTMLTextAreaElement) {
        return true;
      }
      return el instanceof HTMLInputElement && !SKIP_TYPES.has(el.type);
    }

    // Selects: open this list in place of Chrome's when a value matches.
    function onMouseDown(event) {
      if (!isTrusted(event) || inBox(event)) {
        return;
      }
      const select = event.target.closest?.('select');
      if (
        !settings.enabled ||
        !select ||
        select.disabled ||
        select.multiple ||
        event.button !== 0
      ) {
        return;
      }
      if (event.shiftKey) {
        event.preventDefault();
        toggleSelected(select);
        if (selected.size) {
          show(select);
        } else {
          hide();
        }
        return;
      }
      clearSelected();
      if (!groupItems([select]).length) {
        return;
      }
      event.preventDefault();
      if (active === select) {
        hide();
      } else {
        show(select);
      }
    }

    function onClick(event) {
      if (!isTrusted(event) || inBox(event)) {
        return;
      }
      if (event.target.closest?.('select')) {
        return;
      }
      const input = event.target.closest?.('input,textarea');
      if (settings.enabled && isTextField(input)) {
        if (event.shiftKey) {
          toggleSelected(input);
          if (!selected.size) {
            hide();
            return;
          }
        } else {
          clearSelected();
        }
        show(input);
      } else {
        clearSelected();
        hide();
      }
    }

    // Only open on focus when the person tabbed there, not when a page
    // focuses a field by script.
    let lastTab = 0;
    function onKeyDown(event) {
      if (!isTrusted(event)) {
        return;
      }
      if (event.key === 'Tab') {
        lastTab = Date.now();
      }
      if (event.key === 'Escape') {
        clearSelected();
        hide();
      }
    }

    function onFocusIn(event) {
      if (!isTrusted(event) || Date.now() - lastTab > 500) {
        return;
      }
      if (
        settings.enabled &&
        isTextField(event.target) &&
        event.target !== active
      ) {
        show(event.target);
      }
    }

    function onFocusOut(event) {
      if (event.target === active) {
        hide();
      }
    }

    function onScroll() {
      if (box.style.display !== 'none') {
        place();
      }
    }

    function use(list) {
      if (!isList(list)) {
        return;
      }
      settings = list;
      if (!settings.enabled) {
        clearSelected();
        hide();
      }
    }

    function onStorage(changes, area) {
      if (area === 'local' && changes[KEY]) {
        use(changes[KEY].newValue);
      }
    }

    const listeners = [
      [document, 'mousedown', onMouseDown],
      [document, 'click', onClick],
      [document, 'keydown', onKeyDown],
      [document, 'focusin', onFocusIn],
      [document, 'focusout', onFocusOut],
      [window, 'scroll', onScroll],
      [window, 'resize', place],
    ];

    storage
      .get(KEY)
      .then((saved) => use(saved?.[KEY]))
      .catch(() => undefined);
    onChanged.addListener(onStorage);
    for (const [target, type, listener] of listeners) {
      target.addEventListener(type, listener, true);
    }

    function stop() {
      clearSelected();
      hide();
      host.remove();
      for (const [target, type, listener] of listeners) {
        target.removeEventListener(type, listener, true);
      }
      try {
        onChanged.removeListener(onStorage);
      } catch {
        // The extension was reloaded; its storage is gone.
      }
    }

    return { stop, box };
  }

  // Tests start it themselves. A page can't set this: content scripts have
  // their own globals.
  const testHook = globalThis.__pieSuggestTest;
  if (testHook) {
    testHook.start = start;
    return;
  }

  // Loaded again after the extension was reloaded: the old copy steps aside.
  try {
    globalThis.__pieSuggestStop?.();
  } catch {
    // The old copy belongs to an extension context that is gone.
  }
  const { stop } = start({
    storage: chrome.storage.local,
    onChanged: chrome.storage.onChanged,
  });
  globalThis.__pieSuggestStop = stop;
})();
