export const DRAFT_KEY = "med-intake:draft";
export const PREFS_KEY = "med-intake:prefs";
export const DRAFT_VERSION = 1;
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * localStorage can throw on access (private mode, disabled cookies, sandboxed
 * iframe). Probe it once and degrade gracefully instead of crashing the form.
 */
export function getSafeStorage() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = "__med_intake_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createDraftStore({
  storage = getSafeStorage(),
  key = DRAFT_KEY,
  prefsKey = PREFS_KEY,
  version = DRAFT_VERSION,
  ttlMs = DRAFT_TTL_MS,
  now = () => Date.now(),
} = {}) {
  const available = Boolean(storage);

  function removeDraft() {
    try {
      storage?.removeItem(key);
    } catch {
      // Ignore: storage is unavailable or read-only.
    }
  }

  return {
    available,
    key,
    prefsKey,

    load() {
      if (!storage) return { status: "unavailable" };

      let raw;
      try {
        raw = storage.getItem(key);
      } catch {
        return { status: "unavailable" };
      }
      if (!raw) return { status: "empty" };

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        removeDraft();
        return { status: "corrupt" };
      }

      if (!isPlainObject(data) || data.version !== version) {
        removeDraft();
        return { status: "stale" };
      }

      const savedAtMs = Date.parse(data.savedAt);
      const currentMs = now();
      if (
        !Number.isFinite(savedAtMs) ||
        currentMs - savedAtMs > ttlMs ||
        savedAtMs > currentMs + 60_000
      ) {
        removeDraft();
        return { status: "expired" };
      }

      if (!isPlainObject(data.values)) {
        removeDraft();
        return { status: "corrupt" };
      }

      return {
        status: "ok",
        values: data.values,
        savedAt: new Date(savedAtMs),
      };
    },

    save(values) {
      if (!storage) return { ok: false, reason: "unavailable" };
      const savedAt = new Date(now());
      try {
        storage.setItem(
          key,
          JSON.stringify({
            version,
            savedAt: savedAt.toISOString(),
            values,
          }),
        );
        return { ok: true, savedAt };
      } catch (error) {
        const reason =
          error?.name === "QuotaExceededError" || error?.code === 22
            ? "quota"
            : "error";
        return { ok: false, reason };
      }
    },

    clear() {
      if (!storage) return false;
      try {
        storage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },

    loadPrefs() {
      if (!storage) return { draftEnabled: true };
      try {
        const raw = storage.getItem(prefsKey);
        if (!raw) return { draftEnabled: true };
        const data = JSON.parse(raw);
        if (isPlainObject(data) && typeof data.draftEnabled === "boolean") {
          return { draftEnabled: data.draftEnabled };
        }
      } catch {
        // Fall through to the default.
      }
      return { draftEnabled: true };
    },

    savePrefs(prefs) {
      if (!storage) return false;
      try {
        storage.setItem(
          prefsKey,
          JSON.stringify({ draftEnabled: Boolean(prefs.draftEnabled) }),
        );
        return true;
      } catch {
        return false;
      }
    },
  };
}
