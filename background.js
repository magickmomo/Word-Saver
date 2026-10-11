// Chrome can restart Manifest V3 service workers at any time.
// Read the saved dictionary for each operation rather than caching it in memory.
let operationQueue = Promise.resolve();

function enqueue(operation) {
  const result = operationQueue.then(operation);
  operationQueue = result.catch((error) => {
    console.error("Dictionary operation failed:", error);
  });
  return result;
}

async function readDictionary() {
  const { dictionary } = await chrome.storage.local.get("dictionary");
  return Array.isArray(dictionary) ? dictionary : [];
}

function wordName(entry) {
  return (entry?.definition?.word || entry?.definition?.results?.[0]?.id || "")
    .toLowerCase()
    .trim();
}

async function updateDictionary(transform) {
  return enqueue(async () => {
    const current = await readDictionary();
    const next = transform(current);
    if (!Array.isArray(next)) throw new Error("Invalid dictionary update");
    await chrome.storage.local.set({ dictionary: next });
    return next;
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    // Rebuilding the menu is safe on extension updates and reloads.
    // This does not touch the saved dictionary.
    await chrome.contextMenus.removeAll();
    await chrome.contextMenus.create({
      id: "Save",
      title: "Save word",
      contexts: ["selection"],
    });
  } catch (error) {
    console.error("Unable to initialize Save word context menu:", error);
  }
  // Never initialize storage with an empty dictionary on install/update.
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type === "deleteWord") {
    updateDictionary((words) => words.filter((item) => wordName(item) !== request.word))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (request?.type === "retryDefinition") {
    const word = String(request.word || "").toLowerCase().trim();
    if (!word) { sendResponse({ ok: false, error: "Missing word" }); return false; }
    retryDefinition(word).then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (request?.type === "resumePending") {
    readDictionary().then((words) => {
      for (const entry of words) {
        if (!hasDefinition(entry) && entry.status === "loading") void retryDefinition(wordName(entry));
      }
      sendResponse({ ok: true });
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (request?.type === "importWords") {
    updateDictionary((current) => {
      const incoming = request.words;
      if (!Array.isArray(incoming) ||
          incoming.some((entry) => !entry || typeof entry !== "object" || !wordName(entry))) {
        throw new Error("Invalid dictionary backup");
      }
      const merged = [...current];
      const known = new Set(current.map(wordName));
      for (const entry of incoming) {
        const name = wordName(entry);
        if (!known.has(name)) {
          merged.push(entry);
          known.add(name);
        }
      }
      return merged;
    }).then((words) => sendResponse({ ok: true, count: words.length }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});

// Keep only one network request per word in each service-worker lifetime.
const fetching = new Set();

function hasDefinition(entry) {
  return Array.isArray(entry?.definition?.meanings) ||
    Array.isArray(entry?.definition?.results);
}

async function resolveDefinition(word) {
  if (fetching.has(word)) return;
  fetching.add(word);
  try {
    const response = await fetchDefinitionWithRetry(word);
    if (!response.ok) {
      if (response.status === 404) throw new Error("Word not found");
      throw new Error(`Dictionary API returned HTTP ${response.status}`);
    }
    const data = await response.json();
    const meanings = (Array.isArray(data?.en) ? data.en : [])
      .map((part) => ({
        partOfSpeech: part.partOfSpeech || "",
        definitions: (part.definitions || [])
          .map((sense) => ({
            definition: wiktionaryText(sense.definition),
            example: wiktionaryText(sense.examples?.[0]),
            synonyms: [],
          }))
          .filter((sense) => sense.definition),
      }))
      .filter((part) => part.definitions.length);
    if (!meanings.length) throw new Error("No English definition found");
    // Preserve the existing popup data shape for old and new saved entries.
    const definition = { word, meanings, source: "Wiktionary" };
    const synonyms = [];
    await updateDictionary((words) => words.map((entry) =>
      wordName(entry) === word && !hasDefinition(entry)
        ? { ...entry, definition, synonyms, status: "ready", error: undefined }
        : entry
    ));
  } catch (error) {
    console.error(`Unable to fetch definition for ${word}:`, error);
    await updateDictionary((words) => words.map((entry) =>
      wordName(entry) === word && !hasDefinition(entry)
        ? { ...entry, status: "error", error: error.message }
        : entry
    ));
  } finally {
    fetching.delete(word);
  }
}

async function retryDefinition(word) {
  const found = await updateDictionary((words) => words.map((entry) =>
    wordName(entry) === word && !hasDefinition(entry)
      ? { ...entry, status: "loading", error: undefined }
      : entry
  ));
  if (found.some((entry) => wordName(entry) === word && !hasDefinition(entry))) {
    void resolveDefinition(word);
  }
}

chrome.contextMenus.onClicked.addListener(async (clickData, tab) => {
  if (clickData.menuItemId !== "Save" || !clickData.selectionText) return;
  const word = clickData.selectionText.toLowerCase().trim();
  if (!word) return;
  try {
    // Persist immediately, before any network request. Existing entries retain definitions.
    const words = await updateDictionary((current) => {
      const index = current.findIndex((entry) => wordName(entry) === word);
      if (index >= 0) {
        const updated = current.slice();
        updated.unshift(...updated.splice(index, 1));
        return updated;
      }
      return [{ definition: { word }, addedAt: new Date().toISOString(), status: "loading", synonyms: [] }, ...current];
    });
    // Storage change listeners update other tabs; explicitly notify the source tab.
    // Fail quietly on pages where content scripts cannot run (e.g. chrome:// pages).
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "wordSaverRefresh" }).catch(() => {});
    }
    const entry = words.find((item) => wordName(item) === word);
    if (entry && !hasDefinition(entry)) void retryDefinition(word);
  } catch (error) {
    console.error("Unable to save selected word:", error);
    await showNotification("Save failed", "The word could not be stored. Please try again.");
  }
});

// Wiktionary's definition endpoint returns HTML fragments. Convert these to
// plain text before storing them; the popup only renders textContent.
function wiktionaryText(value) {
  if (typeof value !== "string") return "";
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === "#") {
        const numeric = entity[1]?.toLowerCase() === "x";
        const code = parseInt(entity.slice(numeric ? 2 : 1), numeric ? 16 : 10);
        return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
          && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match;
      }
      return entities[entity.toLowerCase()] || match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

// Retry transient upstream failures, but not permanent errors such as 404.
async function fetchDefinitionWithRetry(word) {
  const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
  const retryable = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!retryable.has(response.status) || attempt === 2) return response;
      lastError = new Error(`Dictionary API returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
  }
  throw lastError;
}

async function showNotification(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title,
      message,
    });
  } catch (error) {
    console.warn("Notification unavailable:", error);
  }
}
