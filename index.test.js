const { initApp, readSavedWords, STORAGE_KEY } = require("./index");

function makeStorage(initial = null) {
  let value = initial;

  return {
    getItem: jest.fn(() => value),
    setItem: jest.fn((key, nextValue) => {
      value = nextValue;
    })
  };
}

function setup() {
  document.body.innerHTML = `
    <form id="search-form">
      <input id="word-input">
    </form>
    <p id="message"></p>
    <section id="result"></section>
    <ul id="saved-words"></ul>
  `;
}

describe("WORDLY DICTIONARY", () => {
  beforeEach(setup);

  test("shows a message for an empty search without fetching", async () => {
    const fetchImpl = jest.fn();
    const app = initApp({ fetchImpl, storage: makeStorage() });

    await app.searchWord("  ");

    expect(document.querySelector("#message").textContent)
      .toBe("Please enter a word to search.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("shows the definition and synonyms", async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{
          word: "bright",
          phonetics: [{ text: "/braɪt/" }],
          meanings: [{
            definitions: [{
              definition: "Giving out or reflecting light."
            }]
          }]
        }]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ word: "shining" }]
      });

    const app = initApp({ fetchImpl, storage: makeStorage() });
    await app.searchWord("bright");

    expect(document.querySelector("#result").textContent)
      .toContain("Giving out or reflecting light.");
    expect(document.querySelector("#result").textContent)
      .toContain("shining");
  });

  test("handles an unknown word", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 404
    });

    const app = initApp({ fetchImpl, storage: makeStorage() });
    await app.searchWord("notarealword");

    expect(document.querySelector("#message").textContent)
      .toContain("No results found");
  });

  test("loads saved words from storage", () => {
    const storage = makeStorage(JSON.stringify(["hello"]));

    initApp({ fetchImpl: jest.fn(), storage });

    expect(document.querySelector("#saved-words").textContent)
      .toContain("hello");
  });

  test("returns an empty list if stored data is invalid", () => {
    expect(readSavedWords(makeStorage("invalid JSON"))).toEqual([]);
    expect(STORAGE_KEY).toBe("wordly-saved-words");
  });
});