const STORAGE_KEY = "wordly-saved-words";

function readSavedWords(storage) {
  try {
    const words = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(words) ? words : [];
  } catch {
    return [];
  }
}

function initApp({
  fetchImpl = (...args) => window.fetch(...args),
  storage = window.localStorage,
  speech = window.speechSynthesis
} = {}) {
  const form = document.querySelector("#search-form");
  const input = document.querySelector("#word-input");
  const message = document.querySelector("#message");
  const result = document.querySelector("#result");
  const savedList = document.querySelector("#saved-words");

  if (!form || !input || !message || !result || !savedList) return;

  let currentWord = null;
  let savedWords = readSavedWords(storage);

  function showMessage(text = "", isError = false) {
    message.textContent = text;
    message.className = isError
      ? "mt-4 error-message"
      : "mt-4 success-message";
  }

  function renderSavedWords() {
    savedList.replaceChildren();

    if (savedWords.length === 0) {
      const empty = document.createElement("li");
      empty.className = "text-slate-500";
      empty.textContent = "No saved words yet.";
      savedList.append(empty);
      return;
    }

    savedWords.forEach((word) => {
      const item = document.createElement("li");
      item.className = "saved-word";

      const name = document.createElement("span");
      name.textContent = word;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.className = "text-sm font-semibold text-indigo-700";
      removeButton.addEventListener("click", () => {
        savedWords = savedWords.filter((saved) => saved !== word);
        storage.setItem(STORAGE_KEY, JSON.stringify(savedWords));
        renderSavedWords();
        renderResult();
      });

      item.append(name, removeButton);
      savedList.append(item);
    });
  }

  function renderResult() {
    result.replaceChildren();
    if (!currentWord) return;

    const card = document.createElement("article");
    card.className = "word-card";

    const title = document.createElement("h2");
    title.className = "text-2xl font-bold";
    title.textContent = currentWord.word;

    const pronunciation = document.createElement("p");
    pronunciation.className = "mt-1 text-slate-500";
    pronunciation.textContent =
      currentWord.pronunciation || "Pronunciation unavailable";

    const definition = document.createElement("p");
    definition.className = "mt-4";
    definition.textContent = currentWord.definition;

    const synonymsTitle = document.createElement("h3");
    synonymsTitle.className = "mt-4 font-semibold";
    synonymsTitle.textContent = "Synonyms";

    const synonyms = document.createElement("p");
    synonyms.className = "synonyms";
    synonyms.textContent = currentWord.synonyms.length
      ? currentWord.synonyms.join(", ")
      : "No synonyms found.";

    const actions = document.createElement("div");
    actions.className = "mt-5 flex gap-3";

    const listenButton = document.createElement("button");
    listenButton.type = "button";
    listenButton.className =
      "rounded-lg bg-slate-200 px-4 py-2 hover:bg-slate-300";
    listenButton.textContent = "Listen";
    listenButton.addEventListener("click", () => {
      if (
        speech &&
        typeof SpeechSynthesisUtterance !== "undefined"
      ) {
        speech.cancel();
        speech.speak(new SpeechSynthesisUtterance(currentWord.word));
      } else {
        showMessage("Audio playback is not available in this browser.", true);
      }
    });

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className =
      "rounded-lg bg-indigo-100 px-4 py-2 text-indigo-800 hover:bg-indigo-200";
    saveButton.textContent = savedWords.includes(currentWord.word)
      ? "Unsave"
      : "Save";
    saveButton.addEventListener("click", () => {
      if (savedWords.includes(currentWord.word)) {
        savedWords = savedWords.filter((word) => word !== currentWord.word);
      } else {
        savedWords.push(currentWord.word);
      }

      storage.setItem(STORAGE_KEY, JSON.stringify(savedWords));
      renderSavedWords();
      renderResult();
    });

    actions.append(listenButton, saveButton);
    card.append(
      title,
      pronunciation,
      definition,
      synonymsTitle,
      synonyms,
      actions
    );
    result.append(card);
  }

  async function searchWord(rawWord) {
    const word = rawWord.trim();

    if (!word) {
      currentWord = null;
      result.replaceChildren();
      showMessage("Please enter a word to search.", true);
      return;
    }

    showMessage("Searching…");
    result.replaceChildren();

    try {
      const response = await fetchImpl(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      );

      if (response.status === 404) {
        currentWord = null;
        showMessage(`No results found for “${word}”.`, true);
        return;
      }

      if (!response.ok) {
        throw new Error("Dictionary request failed");
      }

      const entries = await response.json();
      const entry = entries[0];
      const meaning = entry?.meanings?.find(
        (item) => item.definitions?.length
      );
      const definition = meaning?.definitions?.[0]?.definition;

      if (!definition) {
        currentWord = null;
        showMessage(`No definition found for “${word}”.`, true);
        return;
      }

      const pronunciation =
        entry.phonetics?.find((item) => item.text)?.text || "";

      let synonyms = [];
      try {
        const synonymResponse = await fetchImpl(
          `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=8`
        );

        if (synonymResponse.ok) {
          const synonymData = await synonymResponse.json();
          synonyms = synonymData
            .map((item) => item.word)
            .filter(Boolean);
        }
      } catch {
        // Keep the definition if the optional synonyms request fails.
      }

      currentWord = {
        word: entry.word || word,
        pronunciation,
        definition,
        synonyms
      };

      showMessage("");
      renderResult();
    } catch {
      currentWord = null;
      result.replaceChildren();
      showMessage(
        "Something went wrong. Check your connection and try again.",
        true
      );
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    searchWord(input.value);
  });

  renderSavedWords();

  return { searchWord };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { initApp, readSavedWords, STORAGE_KEY };
} else {
  initApp();
}