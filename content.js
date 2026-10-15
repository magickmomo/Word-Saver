// Highlight saved vocabulary and show its stored definition when clicked.
// Mark.js is bundled locally in the extension; no network requests are made here.
(() => {
  if (!document.body || typeof Mark !== "function") return;

  const instance = new Mark(document.body);
  const highlightSelector = "mark.word-saver-highlight";
  let entriesByWord = new Map();
  let words = [];
  let matchingWord = "";
  let running = false;
  let rerun = false;
  let refreshTimer;
  let observer;
  let activeMark = null;
  let activeWord = null;
  let tooltipHost = null;

  function normalizedWord(entry) {
    const word = entry?.definition?.word || entry?.definition?.results?.[0]?.id;
    return typeof word === "string" ? word.trim().toLowerCase() : "";
  }

  const highlightOptions = {
    element: "mark",
    className: "word-saver-highlight",
    accuracy: "exactly",
    separateWordSearch: false,
    caseSensitive: false,
    // The same word can span multiple inline elements on rich-text sites.
    acrossElements: true,
    iframes: false,
    exclude: [
      "script", "style", "noscript", "textarea", "input", "select", "option",
      "button", "code", "pre", "kbd", "samp", "svg", "canvas",
      "[contenteditable]", "[contenteditable='true']", "[role='textbox']",
      ".word-saver-highlight"
    ],
    // With acrossElements enabled, individual mark nodes can contain only a
    // fragment of a word. Store the full keyword reported by Mark.js instead.
    filter(_node, keyword) {
      matchingWord = keyword.trim().toLowerCase();
      return true;
    },
    each(mark) {
      mark.dataset.wordSaverWord = matchingWord;
      mark.setAttribute("role", "button");
      mark.setAttribute("tabindex", "0");
      mark.setAttribute("aria-label", `Show saved definition for ${matchingWord}`);
      mark.title = "Show saved definition";
    }
  };

  function sameVocabulary(nextWords) {
    return words.length === nextWords.length &&
      words.every((word) => nextWords.includes(word));
  }

  function applyEntries(entries) {
    const updated = new Map();
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const word = normalizedWord(entry);
        if (word && !updated.has(word)) updated.set(word, entry);
      }
    }
    const nextWords = [...updated.keys()];
    const changed = !sameVocabulary(nextWords);
    entriesByWord = updated;
    words = nextWords;
    if (changed) scheduleHighlight();

    if (activeWord && !entriesByWord.has(activeWord)) closeTooltip();
    else if (tooltipHost) renderTooltipContent();
  }

  function watch() {
    observer?.observe(document.body, {
      childList: true, characterData: true, subtree: true
    });
  }

  function scheduleHighlight() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(highlight, 350);
  }

  // Disconnect while Mark.js edits the DOM to avoid triggering our observer.
  function highlight() {
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    closeTooltip();
    observer?.disconnect();
    instance.unmark({
      element: "mark",
      className: "word-saver-highlight",
      done() {
        if (!words.length) return finish();
        instance.mark(words, { ...highlightOptions, done: finish });
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
      const { dictionary } = await chrome.storage.local.get("dictionary");
      applyEntries(dictionary);
    } catch (error) {
      console.warn("Word-Saver: unable to read saved words", error);
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Support both current Wiktionary entries and previously stored dictionaries.
  function meaningsFor(entry) {
    const definition = entry?.definition;
    if (Array.isArray(definition?.meanings)) return definition.meanings;
    return (definition?.results?.[0]?.lexicalEntries || []).map((lexical) => ({
      partOfSpeech: lexical.lexicalCategory?.text || lexical.lexicalCategory || "",
      definitions: (lexical.entries || []).flatMap((item) =>
        (item.senses || []).map((sense) => ({
          definition: (sense.definitions || []).join("; "),
          example: sense.examples?.[0]?.text || ""
        }))
      )
    }));
  }

  function closeTooltip() {
    tooltipHost?.remove();
    tooltipHost = null;
    activeMark = null;
    activeWord = null;
  }

  function positionTooltip() {
    if (!tooltipHost || !activeMark) return;
    if (!activeMark.isConnected) return closeTooltip();

    const markRect = activeMark.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    if (markRect.bottom < 0 || markRect.top > viewportHeight) return closeTooltip();

    const margin = 10;
    const width = Math.min(320, Math.max(180, viewportWidth - 2 * margin));
    tooltipHost.style.width = `${width}px`;
    const popupHeight = tooltipHost.getBoundingClientRect().height;
    const left = Math.max(margin, Math.min(markRect.left, viewportWidth - width - margin));
    // Prefer directly beneath the highlighted word; flip above near the bottom.
    let top = markRect.bottom + 7;
    if (top + popupHeight > viewportHeight - margin &&
        markRect.top - popupHeight - 7 >= margin) {
      top = markRect.top - popupHeight - 7;
    }
    top = Math.max(margin, Math.min(top, viewportHeight - popupHeight - margin));
    tooltipHost.style.left = `${left}px`;
    tooltipHost.style.top = `${top}px`;
  }

  function renderTooltipContent() {
    if (!tooltipHost || !activeWord) return;
    const root = tooltipHost.shadowRoot;
    const card = root.querySelector(".card");
    if (!card) return;
    const entry = entriesByWord.get(activeWord);
    if (!entry) return closeTooltip();

    card.replaceChildren();
    const header = element("div", "header");
    const heading = element("strong", "heading",
      entry.definition?.word || entry.definition?.results?.[0]?.id || activeWord);
    header.appendChild(heading);
    const close = element("button", "close", "×");
    close.type = "button";
    close.title = "Close definition";
    close.setAttribute("aria-label", "Close definition");
    close.addEventListener("click", closeTooltip);
    header.appendChild(close);
    card.appendChild(header);

    const phonetic = entry.definition?.phonetic ||
      entry.definition?.results?.[0]?.lexicalEntries?.[0]?.pronunciations?.[0]?.phoneticSpelling;
    if (phonetic) card.appendChild(element("div", "phonetic", `/${phonetic}/`));

    const meanings = meaningsFor(entry);
    let count = 0;
    for (const meaning of meanings) {
      if (count >= 4) break;
      if (meaning.partOfSpeech) card.appendChild(element("div", "part-of-speech", meaning.partOfSpeech));
      for (const sense of (meaning.definitions || [])) {
        if (count >= 4) break;
        const definition = typeof sense === "string" ? sense : sense.definition;
        if (!definition || typeof definition !== "string") continue;
        const paragraph = element("p", "definition", definition);
        card.appendChild(paragraph);
        if (sense.example && count < 2) {
          card.appendChild(element("p", "example", `“${sense.example}”`));
        }
        count++;
      }
    }

    if (count === 0) {
      const unavailable = entry.status === "error";
      card.appendChild(element("p", "status",
        unavailable ? "Definition unavailable" : "Loading definition…"));
      if (unavailable) {
        const retry = element("button", "retry", "Retry definition");
        retry.type = "button";
        retry.addEventListener("click", async () => {
          retry.disabled = true;
          try {
            const result = await chrome.runtime.sendMessage({
              type: "retryDefinition", word: activeWord
            });
            if (!result?.ok) throw new Error(result?.error || "Retry failed");
          } catch (error) {
            retry.disabled = false;
            card.appendChild(element("p", "status", "Couldn't retry. Try from the extension popup."));
          }
        });
        card.appendChild(retry);
      }
    }
    if (entry.definition?.source === "Wiktionary") {
      const credit = element("a", "source", "Wiktionary");
      credit.href = `https://en.wiktionary.org/wiki/${encodeURIComponent(activeWord)}#English`;
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
      card.appendChild(credit);
    }
    positionTooltip();
  }

  function showTooltip(mark, keyboard = false) {
    const word = mark?.dataset.wordSaverWord;
    if (!word || !entriesByWord.has(word)) return;
    if (activeMark === mark && tooltipHost) {
      closeTooltip();
      return;
    }
    closeTooltip();
    activeMark = mark;
    activeWord = word;

    // Shadow DOM keeps the host website's CSS from changing the definition box.
    tooltipHost = document.createElement("word-saver-tooltip");
    const shadow = tooltipHost.attachShadow({ mode: "open" });
    const styles = document.createElement("style");
    styles.textContent = `
      :host {
        all: initial;
        position: fixed;
        display: block;
        z-index: 2147483647;
        width: 320px;
        max-height: calc(100vh - 20px);
        color-scheme: light;
      }
      *, *::before, *::after { box-sizing: border-box; }
      .card {
        font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #20242b;
        background: #fff;
        border: 1px solid #d4dae3;
        box-shadow: 0 8px 28px rgba(0, 0, 0, .18);
        border-radius: 9px;
        padding: 12px 14px;
        max-height: min(320px, calc(100vh - 20px));
        overflow-y: auto;
        overflow-wrap: anywhere;
      }
      .header { display: flex; align-items: start; justify-content: space-between; gap: 10px; }
      .heading { font-size: 16px; line-height: 1.3; }
      .close {
        flex: none; border: none; background: transparent; color: #667085;
        font: 22px/1 system-ui, sans-serif; cursor: pointer; padding: 0 2px;
      }
      .close:hover, .close:focus-visible { color: #111827; }
      .phonetic { color: #667085; margin-top: 3px; font-size: 12px; }
      .part-of-speech { font-style: italic; color: #667085; margin-top: 9px; font-size: 12px; }
      .definition { margin: 5px 0 0; }
      .example { margin: 4px 0 0; font-size: 12px; color: #667085; }
      .status { margin: 8px 0 0; color: #666; }
      .retry {
        margin-top: 8px; cursor: pointer; background: #f8fafc;
        border: 1px solid #cbd5e1; border-radius: 5px; padding: 5px 9px;
      }
      .source { display: inline-block; margin-top: 10px; font-size: 11px; color: #346799; }
    `;
    shadow.appendChild(styles);
    const card = element("div", "card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", `Saved definition for ${word}`);
    shadow.appendChild(card);
    document.documentElement.appendChild(tooltipHost);
    renderTooltipContent();
    if (keyboard) shadow.querySelector(".close")?.focus();
  }

  // One delegated listener handles all current and future highlighted words.
  document.addEventListener("click", (event) => {
    if (tooltipHost && event.composedPath().includes(tooltipHost)) return;
    const mark = event.target?.closest?.(highlightSelector);
    if (!mark) return closeTooltip();
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    showTooltip(mark);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && tooltipHost) {
      const previousMark = activeMark;
      closeTooltip();
      if (previousMark?.isConnected) previousMark.focus({ preventScroll: true });
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    const mark = event.target?.closest?.(highlightSelector);
    if (!mark) return;
    event.preventDefault();
    event.stopPropagation();
    showTooltip(mark, true);
  }, true);

  window.addEventListener("scroll", positionTooltip, { passive: true, capture: true });
  window.addEventListener("resize", positionTooltip, { passive: true });

  // Watch SPA text insertions and edits, but don't watch inside the shadow popup.
  observer = new MutationObserver((mutations) => {
    if (!words.length) return;
    if (mutations.some((mutation) => {
      if (mutation.type === "characterData") return !!mutation.target.textContent?.trim();
      return [...mutation.addedNodes].some((node) =>
        (node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()) ||
        (node.nodeType === Node.ELEMENT_NODE && !node.closest?.(".word-saver-highlight"))
      );
    })) scheduleHighlight();
  });
  watch();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.dictionary) applyEntries(changes.dictionary.newValue);
  });

  // A right-click save can also explicitly refresh the originating tab.
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "wordSaverRefresh") void loadWords();
  });

  loadWords();
})();
