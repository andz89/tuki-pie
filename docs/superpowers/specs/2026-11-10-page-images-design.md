# Page images: design

Date: 2026-11-10

Builds on `2026-11-09-page-info-design.md`. The image list follows tuki's `extractImages` (`src/content/modules/images.js`).

## What we are building

An **Images** tab next to **Links** in the Web Page window, listing every image on the page.

Decisions taken with the user:

- First version: list plus basic actions. No download, no bulk select, no .zip.
- Images are found as in tuki: every `<img>` whose `src` is an http(s) address, each address once, in page order. `data:`, `blob:` and other addresses are left out.

## What the user sees

```
 [ Page info ] [ Links (42) ] [ Images (18) ]

 [ Show only images whose address contains...   ]
 18 images (2 broken)                    [Open all (18)]

 [thumb] https://site.com/hero.jpg
         [Copy URL] [Open]
 [  x  ] https://site.com/old.png
         Broken: the image did not load.
         [Copy URL] [Open]
```

- Each row has a thumbnail. Clicking it shows the image full size, with previous and next arrows (and the Left/Right keys) through the images listed, and a "3 / 18" counter. The arrows stop at the first and last image. A click anywhere else, or Escape, closes it.
- A thumbnail that fails to load marks the row Broken, and the summary counts broken images.
- The filter works like the Links filter: case-insensitive, every word must appear in the address.
- Open opens the image in a background tab in Chrome. Open all opens the shown images, asking first above 15, at most `MAX_OPEN_LINKS`. Both need Chrome connected and follow the saved Link filters, like links.
- The tab counts every image found.

## How it works

- `collect-page.js` (both copies) returns `images: string[]`, capped at `MAX_PAGE_LIST`.
- `PageData` gets `images: list(Url)`; `PageReport` carries it through.
- `src/renderer/page-info/page-images.ts`: `filterImages(urls, filter)`, shared address matching with Links.
- `src/renderer/page-info/PageImages.tsx`: the tab's list. Opening reuses `pageInfoBridge.openLinks`.
- Thumbnails only load web addresses (`shareImageSource`), with `referrerPolicy="no-referrer"`.
