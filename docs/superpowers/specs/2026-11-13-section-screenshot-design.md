# Section screenshot: design

Date: 2026-11-13

Builds on `2026-11-10-page-screenshot-design.md`.

## What we are building

The Screenshot tab in the Web Page window can take a picture of one part of the page instead of the whole page. The user types a CSS selector for it.

Decisions taken with the user:

- A dropdown says how the Section field is read, so nobody has to type a period or # unless they want CSS:
  - **Class name** (default): one or more class names of the same element, without periods. `et_pb_section et_flex_section` becomes `.et_pb_section.et_flex_section`. Periods typed anyway are ignored.
  - **ID**: one id, without #. Spaces give "An id has no spaces. Choose Class name or Mixed for more than one name."
  - **Mixed**: a CSS selector as typed. The note says to put a period before each class and # before each id.
- Pie Launcher builds the selector (escaping names CSS would misread, like `2col` or `md:flex`) in `src/shared/section-selector.ts`; the extension uses it exactly as given.
- When several elements match, the first one is taken, and the tab says how many matched.
- The picture is the element's box, with no margin around it.

## What the user sees

```
 View as [Desktop (the Chrome tab as it is) v]
 Section
 [Class name v] [ et_pb_section et_flex_section ]
 One or more class names of the same element, without periods. Leave empty for the whole page.
 [ Take screenshot ]

 After:
   Section .pricing-table: 1280 x 640 px · 180 KB      [Retake] [Save] [Copy]
   3 elements match. This is the first.
```

- The field is kept across pages, like the device choice.
- It works with every device size: the element is measured after the page has its new size.
- Problems, shown like the other capture problems. The picture you already had stays:
  - Nothing matches: "Nothing on the page matches .pricing-table."
  - Not a selector: "That isn't a CSS selector. Use .class, #id or another selector."
  - Matches, but has no size (hidden): "The element matching .pricing-table isn't shown on the page."
- Saved as `<page title> <device> <section> <date time>.jpg`, with characters Windows refuses taken out.

## How it works

- `CaptureSize` gets `section: string` (empty for the whole page). It goes through IPC (at most 500 characters), the controller, the Chrome site and the extension's `tabs.capture` to `capture.js` as `selector`.
- A page function `sectionBox(selector)` returns `{ error: 'bad-selector' }`, `{ error: 'no-section' }`, `{ error: 'empty-section' }` or the first match's box in page coordinates plus `matches`.
- Debugger path: after the view is as tall as the page, measure the box and use it as the `clip`, cut to the captured area. A missing section is returned as `{ error }`, not thrown, so it never falls back to stitching.
- Stitch path: measure the box first, then scroll and capture only the screens that cover it, and draw only its columns. The picture is as tall as the box.
- The reply carries `matches`. The Screenshot tab shows the section and, when more than one matched, the note.
