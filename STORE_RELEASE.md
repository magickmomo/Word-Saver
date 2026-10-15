# Chrome Web Store release checklist — Little Dictionary 1.0.0

This checklist describes the **first public Chrome Web Store submission**. It is not a substitute for a real Chrome browser test or for completing Google's developer dashboard yourself.

## Suggested store listing

**Name:** Little Dictionary

**Short description:**
Save words while reading, revisit definitions, and highlight saved words across webpages.

**Detailed description:**

> Build your vocabulary as you browse.
>
> Find an unfamiliar word? Select it, right-click, and choose **Save word**. Little Dictionary stores it in your personal word list and looks up its meaning using English Wiktionary.
>
> When you encounter the word again, the extension highlights it on the webpage. Click the highlighted word to open a compact definition card nearby—without losing your place in the article.
>
> You can search saved vocabulary, remove words, and import or export a JSON backup.
>
> Little Dictionary keeps your saved vocabulary locally in your browser. It checks webpage text locally for saved words and sends only the selected word or phrase to Wiktionary when looking up its definition. See the privacy policy for details.
>
> Some browser pages and websites restrict extensions, so highlighting may not work everywhere.

**Suggested category:** Education (or Productivity if that better matches the audience).

**Homepage:** https://github.com/magickmomo/Word-Saver

**Privacy policy URL (after merging the release PR):**
https://github.com/magickmomo/Word-Saver/blob/master/PRIVACY.md

**Support URL:** https://github.com/magickmomo/Word-Saver/issues

## Permission explanations for the developer dashboard

- **storage:** Save and read the local dictionary, including word definitions, timestamps, and backups.
- **contextMenus:** Add the "Save word" action when a user selects text and right-clicks.
- **notifications:** Notify the user if a word could not be saved.
- **Access to websites (`<all_urls>` content script):** Read on-screen webpage text locally to find and highlight previously saved words and show definitions when clicked. It does not upload full webpage text, URL lists or browsing history.
- **`https://en.wiktionary.org/*` host permission:** Request definitions for words explicitly saved by the user.

The obsolete `activeTab` permission has been removed. All permissions and access must be explained consistently with the privacy policy.

## Privacy practices — facts to use when answering Google's form

- **Single purpose:** Personal vocabulary saving and recognition while reading webpages.
- **Local processing:** Page text is examined inside the browser to identify saved words. There is no remote page-content processing by the developer.
- **Data sent to another service:** The selected word or phrase is sent to English Wiktionary via HTTPS when the user saves it or retries a definition. Wikimedia may receive standard network metadata.
- **Local storage:** Saved word, definition, save time, and entries imported from backups.
- **Data not used for:** Advertising, analytics, tracking, or sales to third parties.
- **Developer-operated servers:** None. No account/login required.
- **User choice:** Entries can be deleted; backup import/export is manual.

Read Google's dashboard questions carefully: a lookup **does** send the selected text to an external provider, so don't simply claim that no data is transmitted. Review the actual user-data categories and certify Limited Use compliance truthfully.

## Real assets still required from the publisher

- At least **one genuine screenshot** of the extension in use, preferably 1280×800 (640×400 also accepted). Useful screenshots: a highlighted word with its definition card; the extension popup showing saved vocabulary.
- Review the existing 16×16, 48×48 and 128×128 PNG icons, especially how they appear at small sizes. The 128×128 icon is already included in `manifest.json`.
- Choose your publisher name and verify the Chrome Web Store developer account. Complete any required contact/identity verification.
- Optionally add a 440×280 promo image if the dashboard requests or recommends it.
- Test on at least a few websites, a long article, and a dynamic webpage.

## Package for upload

The ZIP must contain the extension files **at the top level**, not inside a wrapping folder:

```text
manifest.json
background.js
content.js
mark.es6.js
highlight.css
popup.html
popup.css
popup.js
icons/icon16.png
icons/icon48.png
icons/icon128.png
```

The `icons/icon.svg` source and this documentation may remain in the repository; they are not required in the release package. Do **not** include `.git` or user backup files.

### Test before submission

- [ ] Load the exact release folder with `chrome://extensions` → Developer mode → Load unpacked.
- [ ] Save a selected word; confirm it appears immediately and a Wiktionary definition loads or fails gracefully.
- [ ] Reload the browser/extension and verify saved words persist.
- [ ] Verify highlighting and click-to-view definitions on several sites; test scrolling, near-screen-edge positioning and dismissing the card.
- [ ] Test deleting a word and confirming its highlights disappear.
- [ ] Export a JSON backup, import it into a clean extension installation, and verify its contents.
- [ ] Confirm the external privacy-policy and support links work.
- [ ] Check the extension page and service worker for errors.
- [ ] Review the rendered extension icon and your genuine listing screenshots.

### Submit

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and register/verify if needed.
2. Choose **New item**, then upload the ZIP.
3. Fill in **Store listing**, **Privacy practices**, and **Distribution** (including initial public or unlisted visibility).
4. Upload the real screenshot(s), confirm all required dashboard fields, and submit for review.
5. After approval, users install with **Add to Chrome**. Every subsequent upload must increment the manifest version.

Official guides:
- [Prepare an extension](https://developer.chrome.com/docs/webstore/prepare)
- [Create a great listing](https://developer.chrome.com/docs/webstore/best-listing)
- [Publish an extension](https://developer.chrome.com/docs/webstore/publish)
- [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies)

**Existing unpacked installs and Chrome Web Store installs use different extension IDs.** To keep an existing personal dictionary, export its JSON backup before switching, then import into the store installation.
