let dictionary = [];

function wordName(entry) {
  return entry?.definition?.word || entry?.definition?.results?.[0]?.id || "";
}

function wordMeanings(entry) {
  const definition = entry?.definition;
  if (Array.isArray(definition?.meanings)) return definition.meanings;
  // Older Oxford API entries use lexicalEntries and senses.
  return (definition?.results?.[0]?.lexicalEntries || []).map((lexical) => ({
    partOfSpeech: lexical.lexicalCategory?.text || lexical.lexicalCategory || "",
    definitions: (lexical.entries || []).flatMap((item) =>
      (item.senses || []).map((sense) => ({
        definition: (sense.definitions || []).join("; "),
        example: sense.examples?.[0]?.text || "",
        synonyms: (sense.synonyms || []).map((synonym) => synonym.text),
      }))
    ),
  }));
}

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function renderDictionary() {
  const list = document.getElementById("dictionary");
  const expandedWords = new Set(
    [...list.querySelectorAll(".collapsible.expand .word")]
      .map((node) => node.textContent.toLowerCase())
  );
  list.replaceChildren();
  for (const entry of dictionary) {
    const name = wordName(entry);
    if (!name) continue;
    const container = element("div", "collapsible");
    if (expandedWords.has(name.toLowerCase())) container.classList.add("expand");
    container.appendChild(element("div", "expand-indicator"));
    const content = element("div", "content");
    const remove = element("button", "remove", "×");
    remove.type = "button";
    remove.title = `Remove "${name}" from dictionary`;
    remove.setAttribute("aria-label", remove.title);
    remove.addEventListener("click", async (event) => {
      event.stopPropagation();
      try {
        const result = await chrome.runtime.sendMessage({ type: "deleteWord", word: name.toLowerCase() });
        if (!result?.ok) throw new Error(result?.error || "Unable to delete word");
        // The storage change listener renders the updated list.
      } catch (error) {
        showStatus(error.message, true);
      }
    });
    content.appendChild(remove);
    content.appendChild(element("p", "word", name));
    if (entry.addedAt) {
      const date = new Date(entry.addedAt);
      if (!Number.isNaN(date.getTime())) {
        const stamp = new Intl.DateTimeFormat("en-GB", {
          day: "numeric", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: false
        }).format(date);
        content.appendChild(element("p", "added-at", `Added ${stamp}`));
      }
    }

    const phonetic = entry.definition?.phonetic ||
      entry.definition?.results?.[0]?.lexicalEntries?.[0]?.pronunciations?.[0]?.phoneticSpelling;
    if (phonetic) content.appendChild(element("p", "phonetic", `/${phonetic}/`));
    const hasDefinition = Array.isArray(entry.definition?.meanings) ||
      Array.isArray(entry.definition?.results);
    if (!hasDefinition) {
      const state = entry.status === "error" ? "error" : "loading";
      const label = state === "error"
        ? (entry.error === "Word not found" ? "Definition not found" : "Definition unavailable")
        : "Loading definition…";
      content.appendChild(element("p", `definition-status ${state}`, label));
      if (state === "error") {
        const retry = element("button", "retry-definition", "Retry");
        retry.type = "button";
        retry.addEventListener("click", async (event) => {
          event.stopPropagation();
          retry.disabled = true;
          try {
            const result = await chrome.runtime.sendMessage({
              type: "retryDefinition", word: name.toLowerCase()
            });
            if (!result?.ok) throw new Error(result?.error || "Retry failed");
          } catch (error) {
            retry.disabled = false;
            showStatus(error.message, true);
          }
        });
        content.appendChild(retry);
      }
    }
    for (const meaning of wordMeanings(entry)) {
      if (meaning.partOfSpeech) content.appendChild(element("p", "type", meaning.partOfSpeech));
      (meaning.definitions || []).forEach((definition, index) => {
        const text = typeof definition === "string" ? definition : definition.definition;
        if (text) content.appendChild(element("p", "definition", `${index + 1}. ${text}`));
        if (definition.example) content.appendChild(element("p", "example", `"${definition.example}"`));
        if (Array.isArray(definition.synonyms) && definition.synonyms.length) {
          content.appendChild(element("p", "synonym", `Synonyms: ${definition.synonyms.join(", ")}`));
        }
      });
    }
    if (entry.definition?.source === "Wiktionary") {
      const attribution = element("a", "source-attribution", "Definition: Wiktionary (CC BY-SA)");
      attribution.href = `https://en.wiktionary.org/wiki/${encodeURIComponent(name)}#English`;
      attribution.target = "_blank";
      attribution.rel = "noopener noreferrer";
      content.appendChild(attribution);
    }
    container.appendChild(content);
    container.addEventListener("click", (event) => {
      if (!event.target.closest(".remove")) container.classList.toggle("expand");
    });
    list.appendChild(container);
  }
  applySearch();
}

function applySearch() {
  const query = document.getElementById("search").value.toLowerCase();
  document.querySelectorAll("#dictionary .collapsible").forEach((item) => {
    const wordElement = item.querySelector(".word");
    const word = wordElement?.textContent || "";
    item.style.display = word.toLowerCase().includes(query) ? "" : "none";
    // Build the highlight using text nodes, not HTML or a user-controlled regex.
    wordElement.replaceChildren();
    const index = query ? word.toLowerCase().indexOf(query) : -1;
    if (index === -1) {
      wordElement.textContent = word;
    } else {
      wordElement.append(document.createTextNode(word.slice(0, index)));
      wordElement.append(element("span", "search-highlight", word.slice(index, index + query.length)));
      wordElement.append(document.createTextNode(word.slice(index + query.length)));
    }
  });
}

function showStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.style.color = isError ? "#b00020" : "#444";
}

async function refreshDictionary() {
  const { dictionary: saved } = await chrome.storage.local.get("dictionary");
  dictionary = Array.isArray(saved) ? saved : [];
  renderDictionary();
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("search").addEventListener("input", applySearch);
  document.getElementById("export").addEventListener("click", async () => {
    try {
      const { dictionary: saved } = await chrome.storage.local.get("dictionary");
      const blob = new Blob([JSON.stringify(Array.isArray(saved) ? saved : [], null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "word-saver-backup.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showStatus("Backup exported.");
    } catch (error) {
      showStatus(error.message, true);
    }
  });
  document.getElementById("import").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const words = JSON.parse(await file.text());
      if (!Array.isArray(words)) throw new Error("Backup must contain a list of words.");
      const result = await chrome.runtime.sendMessage({ type: "importWords", words });
      if (!result?.ok) throw new Error(result?.error || "Import failed");
      showStatus(`Import complete. ${result.count} total words.`);
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      event.target.value = "";
    }
  });
  try {
    await refreshDictionary();
    // If Chrome suspended the worker mid-request, resume pending lookups on popup open.
    chrome.runtime.sendMessage({ type: "resumePending" }).catch(console.error);
  } catch (error) {
    showStatus(`Unable to load dictionary: ${error.message}`, true);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.dictionary) {
    refreshDictionary().catch((error) => showStatus(error.message, true));
  }
});
