# Little Dictionary

**Save unfamiliar words while reading, revisit their meanings, and recognise them when you encounter them again.**

Little Dictionary is a lightweight Chrome extension. Select a word on a webpage, right-click and choose **Save word**. The extension keeps it in your personal dictionary and retrieves an English definition from [Wiktionary](https://en.wiktionary.org/).

When you encounter a saved word on another webpage, it is highlighted. Click the highlight to open a small definition card next to the word.

## Features

- Save selected words or phrases using the browser's right-click menu.
- View definitions and usage examples in the extension popup.
- Highlight previously saved words in webpage text, with a click-to-open definition card.
- Search your saved vocabulary, delete entries, and see the original save date for newer entries.
- Export and import a JSON backup.
- Retry unavailable definitions.

Definitions come from English Wiktionary. The exact availability of definitions depends on that service. Some websites or browser pages do not allow extension content scripts or may render text in ways the highlighter cannot match.

## Install for local testing

1. Download the repository ZIP from the `master` branch and extract it.
2. Go to `chrome://extensions` and switch on **Developer mode**.
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Refresh any webpages that were open before the extension was loaded.
5. Select a word on a webpage, right-click and choose **Save word**. Open the extension popup to see your dictionary.

**Important:** Installing a future Chrome Web Store copy creates a different extension installation from a local unpacked copy. Export a JSON backup from the current installation before switching, then import it into the store version. Keep the backup somewhere safe.

## Privacy

Your vocabulary is stored in `chrome.storage.local`. Webpage text is examined in the browser to identify saved words; whole webpages, URLs and browsing history are not sent to a remote server. The selected text you save is sent to English Wiktionary to obtain definitions.

Read the full [privacy policy](PRIVACY.md).

## Chrome Web Store publication

See [STORE_RELEASE.md](STORE_RELEASE.md) for listing text, permission explanations, screenshot requirements, packaging and the manual publishing checklist.

## Credits

- Definitions: [English Wiktionary](https://en.wiktionary.org/) (see attribution and licence information in the extension).
- Highlighting: bundled [mark.js](https://markjs.io/) by Julian Kühnel, MIT licence. See [third-party notices](THIRD_PARTY_NOTICES.md).

For feedback or issues, use [GitHub Issues](https://github.com/magickmomo/Word-Saver/issues).
