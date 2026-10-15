# Little Dictionary privacy policy

**Effective date:** 15 October 2026

Little Dictionary is a Chrome extension for saving vocabulary, looking up definitions and recognising saved words while reading websites.

## Information the extension uses

- **Selected words:** When you choose **Save word** from the right-click menu, the selected text is saved to your local dictionary. The extension sends that selected text to the English Wiktionary API to retrieve a definition. Do not save private or sensitive text if you do not want it sent to Wiktionary.
- **Webpage text:** To highlight previously saved words, the extension examines page text locally in your browser on websites where Chrome allows the extension to run. The extension does **not** transmit full webpage content, page URLs or browsing history to its developer or to Wiktionary.
- **Saved dictionary:** Words, retrieved definitions, and (for newly saved words) the time each word was added are stored using `chrome.storage.local` on your device. Dictionary backups are downloaded or imported only when you choose those actions.

## Third-party services

For a definition lookup, the extension makes an HTTPS request to **English Wiktionary** (`en.wiktionary.org`) containing the selected word or phrase in the request URL. Wiktionary is operated by the Wikimedia Foundation. As with other web requests, Wikimedia may receive technical information such as the requesting IP address. See the [Wikimedia Foundation privacy policy](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy).

The extension does not send saved words or page contents to a developer-operated server. There are no developer analytics, advertising trackers, or user accounts in the extension.

## Storage, retention and your controls

Your saved dictionary remains in the browser's local extension storage until you delete entries, clear the extension's data or uninstall the extension. You can delete individual words in the popup and export or import a JSON backup. An exported backup is a file on your device, and you are responsible for where you share or store it.

## Purpose and limited use

Little Dictionary uses browser access and any user information solely to deliver its advertised vocabulary-saving, definition lookup and webpage highlighting features. It does not sell user data or use it for advertising.

The use of information received from Chrome or Google APIs adheres to the **Chrome Web Store User Data Policy**, including its **Limited Use** requirements.

## Changes and contact

Changes to this policy will be published in this repository. For questions or privacy requests, open an issue at [Word-Saver on GitHub](https://github.com/magickmomo/Word-Saver/issues).
