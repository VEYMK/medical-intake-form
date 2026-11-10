import test from "node:test";
import assert from "node:assert/strict";

import {
  DRAFT_TTL_MS,
  createDraftStore,
} from "../js/draft.js";

class MemoryStorage {
  constructor() {
    this.map = new Map();
    this.failWrites = false;
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites) {
      const error = new Error("Quota exceeded");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

const T0 = Date.parse("2026-11-09T12:00:00.000Z");

function storeWith(storage, now = () => T0) {
  return createDraftStore({ storage, now, ttlMs: DRAFT_TTL_MS });
}

test("saves and restores a draft", () => {
  const storage = new MemoryStorage();
  const store = storeWith(storage);

  const result = store.save({ firstName: "Иван", phone: "+7 (999) 123-45-67" });
  assert.equal(result.ok, true);

  const loaded = store.load();
  assert.equal(loaded.status, "ok");
  assert.deepEqual(loaded.values, {
    firstName: "Иван",
    phone: "+7 (999) 123-45-67",
  });
  assert.equal(loaded.savedAt.toISOString(), "2026-11-09T12:00:00.000Z");
});

test("returns empty when there is no draft", () => {
  const store = storeWith(new MemoryStorage());
  assert.equal(store.load().status, "empty");
});

test("removes a draft from an older schema version", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    "med-intake:draft",
    JSON.stringify({ version: 0, savedAt: new Date(T0).toISOString(), values: {} }),
  );
  const store = storeWith(storage);

  assert.equal(store.load().status, "stale");
  assert.equal(storage.getItem("med-intake:draft"), null);
});

test("removes a corrupted draft", () => {
  const storage = new MemoryStorage();
  storage.setItem("med-intake:draft", "{not-json");
  const store = storeWith(storage);

  assert.equal(store.load().status, "corrupt");
  assert.equal(storage.getItem("med-intake:draft"), null);
});

test("removes an expired draft", () => {
  const storage = new MemoryStorage();
  const store = storeWith(storage);
  store.save({ firstName: "Иван" });

  const later = createDraftStore({
    storage,
    now: () => T0 + DRAFT_TTL_MS + 1,
    ttlMs: DRAFT_TTL_MS,
  });
  assert.equal(later.load().status, "expired");
  assert.equal(storage.getItem("med-intake:draft"), null);
});

test("rejects a draft saved in the future", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    "med-intake:draft",
    JSON.stringify({
      version: 1,
      savedAt: new Date(T0 + 120_000).toISOString(),
      values: {},
    }),
  );
  assert.equal(storeWith(storage).load().status, "expired");
});

test("reports quota errors without throwing", () => {
  const storage = new MemoryStorage();
  storage.failWrites = true;
  const result = storeWith(storage).save({ firstName: "Иван" });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "quota");
});

test("degrades gracefully when storage is unavailable", () => {
  const store = createDraftStore({ storage: null });

  assert.equal(store.available, false);
  assert.equal(store.load().status, "unavailable");
  assert.deepEqual(store.save({}), { ok: false, reason: "unavailable" });
  assert.equal(store.clear(), false);
});

test("stores the draft-enabled preference separately", () => {
  const storage = new MemoryStorage();
  const store = storeWith(storage);

  assert.deepEqual(store.loadPrefs(), { draftEnabled: true });
  assert.equal(store.savePrefs({ draftEnabled: false }), true);
  assert.deepEqual(store.loadPrefs(), { draftEnabled: false });

  storage.setItem("med-intake:prefs", "{broken");
  assert.deepEqual(store.loadPrefs(), { draftEnabled: true });
});

test("clear removes only the draft, not the preference", () => {
  const storage = new MemoryStorage();
  const store = storeWith(storage);
  store.save({ firstName: "Иван" });
  store.savePrefs({ draftEnabled: false });

  assert.equal(store.clear(), true);
  assert.equal(store.load().status, "empty");
  assert.deepEqual(store.loadPrefs(), { draftEnabled: false });
});
