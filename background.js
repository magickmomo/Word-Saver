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

chrome.contextMenus.onClicked.addListener(async (clickData) => {
  if (clickData.menuItemId !== "Save" || !clickData.selectionText) return;
  const word = clickData.selectionText.toLowerCase().trim();
  if (!word) return;

  try {
    // A previously saved word moves to the top. Fetch only for new words.
    const existing = await enqueue(async () => (await readDictionary()).some((entry) => wordName(entry) === word));
    if (existing) {
      await updateDictionary((words) => {
        const index = words.findIndex((entry) => wordName(entry) === word);
        if (index < 0) return words;
        const updated = words.slice();
        updated.unshift(...updated.splice(index, 1));
        return updated;
      });
      return;
    }

    const response = await fetchDefinitionWithRetry(word);
    if (!response.ok) {
      if (response.status === 404) {
        await showNotification("Word Not Found", `"${word}" was not found in the dictionary.`);
        return;
      }
      throw new Error(`Dictionary API returned HTTP ${response.status}`);
    }
    const entries = await response.json();
    if (!Array.isArray(entries) || !entries[0]?.word || !Array.isArray(entries[0]?.meanings)) {
      throw new Error("Unexpected dictionary API response");
    }
    const definition = entries[0];
    const synonyms = definition.meanings.flatMap((meaning) =>
      (meaning.definitions || []).flatMap((entry) => entry.synonyms || [])
    );
    await updateDictionary((words) => {
      // Check again after the network request to avoid duplicate words.
      if (words.some((entry) => wordName(entry) === word)) return words;
      return [{ definition, synonyms }, ...words];
    });
  } catch (error) {
    console.error("Failed to save word:", error);
    await showNotification("Error", "Unable to save this word. Please try again.");
  }
});

// Retry transient upstream failures, but not permanent errors such as 404.
async function fetchDefinitionWithRetry(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
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
