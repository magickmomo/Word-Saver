// Highlight words the user has previously saved, without changing their dictionary.
// Mark.js is bundled locally by the extension in manifest.json.
(() => {
  if (!document.body || typeof Mark !== "function") return;

  const instance = new Mark(document.body);
  const highlightOptions = {
    element: "mark",
    className: "word-saver-highlight",
    accuracy: "exactly",
    separateWordSearch: false,
    caseSensitive: false,
    acrossElements: false,
    iframes: false,
    exclude: [
      "script", "style", "noscript", "textarea", "input", "select", "option",
      "button", "code", "pre", "kbd", "samp", "svg", "canvas",
      "[contenteditable]", "[contenteditable='true']", "[role='textbox']",
      ".word-saver-highlight"
    ]
  };

  let words = [];
  let running = false;
  let rerun = false;
  let refreshTimer;
  let observer;

  function savedWords(entries) {
    if (!Array.isArray(entries)) return [];
    return [...new Set(entries
      .map((entry) => entry?.definition?.word || entry?.definition?.results?.[0]?.id || "")
      .filter((word) => typeof word === "string")
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean))];
  }

  function watch() {
    if (observer) observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  function scheduleHighlight() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(highlight, 350);
  }

  // Disconnect while Mark.js updates the DOM so its own changes don't trigger loops.
  function highlight() {
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    observer?.disconnect();
    instance.unmark({
      element: "mark",
      className: "word-saver-highlight",
      done() {
        if (!words.length) return finish();
        instance.mark(words, {
          ...highlightOptions,
          done: finish
        });
      }
    });
  }

  function finish() {
    running = false;
    watch();
    if (rerun) {
      rerun = false;
      scheduleHighlight();
    }
  }

  async function loadWords() {
    try {
      const data = await chrome.storage.local.get("dictionary");
      words = savedWords(data.dictionary);
      scheduleHighlight();
    } catch (error) {
      console.warn("Word-Saver: unable to read saved words", error);
    }
  }

  // Watch for newly added article text in single-page applications.
  observer = new MutationObserver((mutations) => {
    if (!words.length) return;
    if (mutations.some((mutation) => {
      if (mutation.type === "characterData") {
        return !!mutation.target.textContent?.trim();
      }
      return [...mutation.addedNodes].some((node) =>
        (node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()) ||
        (node.nodeType === Node.ELEMENT_NODE && !node.closest?.(".word-saver-highlight"))
      );
    })) scheduleHighlight();
  });
  watch();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.dictionary) {
      words = savedWords(changes.dictionary.newValue);
      scheduleHighlight();
    }
  });

  // A right-click save can request an immediate refresh in the originating tab.
  // Reloading the dictionary also handles service-worker messages arriving in any order.
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "wordSaverRefresh") void loadWords();
  });

  loadWords();
})();
