# Safer page links: design

Date: 2026-11-10

## What we are building

Page Info's Links list can open links in the user's logged-in Chrome. A link that changes something when visited (log out, add to cart, a one-time token) would then act as the user. Two layers keep that from happening:

1. **Risky links are left out of the list.** Same rules as tuki's `riskyUrl.js`, plus more words for WordPress, the most checked kind of site.
2. **Links that carry a token or an ID are marked.** They stay in the list as plain text with a Copy button, but nothing in the app opens them.

Decisions taken with the user:

- Follow tuki: risky links are hidden, not labeled.
- "Open all" always skips marked links. No prompt.
- A marked link has no Open button. "Show on page" stays, because it only highlights the link and never visits it.

## Layer 1: risky links (left out)

Checked in `collect-page.js` (both copies) and `show-link.js`, which must find links by the same rules. The rules match every path segment and every query key and value.

- **Action words**, matched as a word anywhere in a part, or as the whole part with separators removed: delete, remove, trash, destroy, purge, logout, logoff, signout, unsubscribe. New: addtocart (`?add-to-cart=`), undoitem (`?undo_item=`), addtowishlist (`?add_to_wishlist=`), deactivate, cancel, optout, doingwpcron (`?doing_wp_cron`).
- **Backend words**, matched only as a whole part: admin, administrator, wp-admin, edit. New: wp-login.php (log out, lost password and reset links), customize_theme, customize_changeset_uuid, and the page builder editors elementor-preview, fl_builder, et_fb (Divi), ct_builder (Oxygen), brizy-edit, vc_editable (WPBakery).
- Any query key containing `nonce`, and `preview=true`.

Admin-only words like approve, spam and restore are not added: those links carry a nonce, and the words would hide blog posts such as "/restore-your-energy". "cancel" and "deactivate" may hide a post like "/how-to-cancel"; that is accepted.

## Layer 2: token or ID links (marked)

`carriesToken(href)` in `src/shared/link-tokens.ts`. Only web links are checked. A link is marked when any of these holds:

- A query key has a secret word (split on separators and camelCase): token, key, apikey, auth, code, sig, signature, hash, hmac, otp, secret, session, sid, ticket, reset, verify, confirm, pass, password, jwt.
- A query key has an ID word: id, uid, uuid, guid (`?id=`, `?order_id=`, `?itemId=`).
- A query value looks random: a UUID, or 16 or more letters and digits with no separators, holding both.
- A path segment is a UUID, or 32 or more hex characters.

Never marked, whatever the value:

- Tracking keys: `utm_*`, fbclid, gclid, gbraid, wbraid, dclid, msclkid, yclid, ttclid, twclid, igshid, li_fat_id, mc_cid, mc_eid, \_ga, \_gl, \_hsenc, \_hsmi, srsltid, ref.
- WordPress keys that only read content: p, page_id, cat, tag, author, m, s, paged, page, cpage, attachment_id, post_type, lang, ver.

## What the user sees

```
 12 links (10 different addresses)         [Open all (7)]
 Open all skips 3 links that carry a token or ID.

 4  https://a.com/order?order_id=55
    Token or ID: copy it if you need it.
    [Show on page] [Copy URL]
```

- The row hint is amber, like other warnings.
- The main process drops marked links from any open request too, so a bug in the window can't open them.
