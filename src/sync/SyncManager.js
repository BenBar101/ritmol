// ═══════════════════════════════════════════════════════════════
// SYNC MANAGER  (File System Access API + fallback download/import)
// ═══════════════════════════════════════════════════════════════
// Security model:
//   - Key allowlist: only SYNC_KEYS are written from an incoming payload.
//   - Schema version check: files from older schema versions are rejected.
//   - Per-key validators (SYNC_VALIDATORS): range, length, shape checks.
//   - Prototype pollution guard: __proto__ / constructor / prototype rejected.
//   - Payload size cap: >10 MB rejected before any write.
//   - geminiKey and googleClientId are read from the file into sessionStorage
//     but NEVER written back out on Push.
// ═══════════════════════════════════════════════════════════════

import { LS, storageKey, setGeminiApiKey, IS_DEV, DEV_PREFIX, today } from "../utils/storage";

// ── Schema version ──────────────────────────────────────────────
export const SYNC_SCHEMA_VERSION = 1;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Storage key for the persisted file handle ────────────────────
const HANDLE_LS_KEY = IS_DEV ? `${DEV_PREFIX}sync_handle` : "sync_handle";

// ── Feature detection ────────────────────────────────────────────
export const FSAPI_SUPPORTED =
  typeof window !== "undefined" &&
  typeof window.showOpenFilePicker === "function" &&
  typeof window.showSaveFilePicker === "function";

// ── Keys written to / read from sync file ────────────────────────
export const SYNC_KEYS = [
  "jv_profile", "jv_xp", "jv_streak", "jv_shields", "jv_last_login",
  "jv_habits", "jv_habit_log", "jv_tasks", "jv_goals", "jv_sessions",
  "jv_achievements", "jv_gacha", "jv_cal_events", "jv_chat",
  "jv_daily_goal", "jv_timers", "jv_sleep_log", "jv_screen_log",
  "jv_missions", "jv_mission_date", "jv_habit_suggestions",
  "jv_chronicles", "jv_gcal_connected", "jv_token_usage",
  "jv_habits_init", "jv_dynamic_costs", "jv_last_shield_use_date",
];

// ── Simple per-key validators ─────────────────────────────────────
const isString = (v) => typeof v === "string";
const isNumber = (v) => typeof v === "number" && isFinite(v);
const isBool   = (v) => typeof v === "boolean";
const isArray  = (v) => Array.isArray(v);
const isObj    = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isDateStr = (v) => isString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isNullOrDateStr = (v) => v === null || isDateStr(v);
const MAX_LOG_ENTRIES = 800; // ~2 years of daily entries
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LOG_VALUE_SIZE = 4096; // per-entry byte cap to prevent log value bloat

function isLogObj(v) {
  if (!isObj(v)) return false;
  const keys = Object.keys(v);
  if (keys.length > MAX_LOG_ENTRIES) return false;
  // Fix: also validate that each value is a safe primitive or small array/object,
  // not an unbounded blob. A crafted sync file could store megabytes in a single
  // log entry otherwise, bypassing the per-key size check.
  return keys.every(k => {
    if (!DATE_KEY_RE.test(k)) return false;
    const val = v[k];
    // Allow: null, bool, number, short string, array of short strings, small plain object
    if (val === null || typeof val === "boolean" || typeof val === "number") return true;
    if (typeof val === "string") return val.length <= MAX_LOG_VALUE_SIZE;
    if (Array.isArray(val)) return val.length <= 200 && val.every(item => typeof item === "string" && item.length <= 200);
    if (isObj(val)) return JSON.stringify(val).length <= MAX_LOG_VALUE_SIZE;
    return false;
  });
}

export const SYNC_VALIDATORS = {
  jv_profile:             (v) => v === null || (isObj(v) && !Object.prototype.hasOwnProperty.call(v, "geminiKey") && !Object.prototype.hasOwnProperty.call(v, "googleClientId")),
  // Fix: add upper bounds — a crafted sync file with jv_xp: 1e18 would
  // otherwise instantly grant max level or an implausible streak/shield count.
  jv_xp:                  (v) => isNumber(v) && v >= 0 && v <= 100_000_000,
  jv_streak:              (v) => isNumber(v) && v >= 0 && v <= 36500,
  jv_shields:             (v) => isNumber(v) && v >= 0 && v <= 10000,
  jv_last_login:          (v) => isNullOrDateStr(v),
  jv_habits:              (v) => isArray(v) && v.length <= 500,
  jv_habit_log:           (v) => isLogObj(v),
  jv_tasks:               (v) => isArray(v) && v.length <= 5000,
  jv_goals:               (v) => isArray(v) && v.length <= 1000,
  jv_sessions:            (v) => isArray(v) && v.length <= 10000,
  jv_achievements:        (v) => isArray(v) && v.length <= 2000,
  jv_gacha:               (v) => isArray(v) && v.length <= 2000,
  jv_cal_events:          (v) => isArray(v) && v.length <= 2000,
  jv_chat:                (v) => {
    if (!isArray(v)) return false;
    if (v.length > 5000) return false;
    return v.every(item => {
      if (!isObj(item)) return false;
      if (!['user', 'assistant'].includes(item.role)) return false;
      if (typeof item.content !== 'string') return false;
      if (item.content.length > 4000) return false; // ~1k token cap per message
      if (item.ts !== undefined && !(typeof item.ts === 'number' && isFinite(item.ts) && item.ts > 0)) return false;
      return true;
    });
  },
  // Fix: accept null for unset state in addition to non-empty strings.
  jv_daily_goal:          (v) => v === null || (isString(v) && v.length <= 500),
  jv_timers:              (v) => isArray(v) && v.length <= 50,
  jv_sleep_log:           (v) => isLogObj(v),
  jv_screen_log:          (v) => isLogObj(v),
  jv_missions:            (v) => v === null || (isArray(v) && v.length <= 20),
  jv_mission_date:        (v) => isNullOrDateStr(v),
  jv_habit_suggestions:   (v) => isArray(v) && v.length <= 200,
  jv_chronicles:          (v) => isArray(v) && v.length <= 500,
  jv_gcal_connected:      (v) => isBool(v),
  jv_token_usage:         (v) => {
    if (!isObj(v)) return false;
    if (v.date !== undefined) {
      if (!isDateStr(v.date)) return false;
      // Fix [S-4]: reject future dates. A crafted sync file with date: "2099-12-31"
      // causes the daily reset branch to fire on every trackTokens call, bypassing
      // the daily token budget entirely (perpetual free reset).
      if (v.date > today()) return false;
    }
    // Fix [S-1]: add upper bounds on tokens and aiXpToday. Without them, a crafted
    // sync file can set tokens to 9 999 999, permanently disabling all AI features,
    // or set aiXpToday to 9 999 999, permanently blocking AI XP awards.
    if (v.tokens !== undefined && !(isNumber(v.tokens) && v.tokens >= 0 && v.tokens <= 10_000_000)) return false;
    if (v.aiXpToday !== undefined && !(isNumber(v.aiXpToday) && v.aiXpToday >= 0 && v.aiXpToday <= 1_000_000)) return false;
    // warnedAt must be an array of safe numeric percentage values (50, 80, 99, etc.)
    if (v.warnedAt !== undefined && !(isArray(v.warnedAt) && v.warnedAt.length <= 20 && v.warnedAt.every(x => typeof x === "number" && isFinite(x) && x >= 0 && x <= 100))) return false;
    return true;
  },
  jv_habits_init:         (v) => isBool(v),
  // Fix: validate dynamic cost fields and enforce the same numeric bounds as
  // dynamicCosts.js so a crafted sync file cannot smuggle out-of-range economy
  // values past this validator.
  jv_dynamic_costs:       (v) => {
    if (v === null) return true;
    if (!isObj(v)) return false;
    if (v.xpPerLevel !== undefined && !(isNumber(v.xpPerLevel) && v.xpPerLevel >= 200 && v.xpPerLevel <= 10000)) return false;
    if (v.gachaCost !== undefined && !(isNumber(v.gachaCost) && v.gachaCost >= 50 && v.gachaCost <= 5000)) return false;
    if (v.streakShieldCost !== undefined && !(isNumber(v.streakShieldCost) && v.streakShieldCost >= 100 && v.streakShieldCost <= 5000)) return false;
    return true;
  },
  jv_last_shield_use_date:(v) => isNullOrDateStr(v),
};

// ── Prototype pollution guard ─────────────────────────────────────
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isSafeSyncValue(v, depth = 0) {
  if (depth > 8) return false;
  if (isObj(v)) {
    for (const k of Object.keys(v)) {
      if (DANGEROUS_KEYS.has(k)) return false;
      if (!isSafeSyncValue(v[k], depth + 1)) return false;
    }
  } else if (isArray(v)) {
    for (const item of v) {
      if (!isSafeSyncValue(item, depth + 1)) return false;
    }
  }
  return true;
}

// ── Payload size guard ────────────────────────────────────────────
export function assertPayloadSize(text) {
  if (typeof text === "string" && new TextEncoder().encode(text).length > MAX_PAYLOAD_BYTES) {
    throw new Error("SYNC_FILE_TOO_LARGE");
  }
}

// ── Persist / restore file handle via IndexedDB ───────────────────
// File handles can't be stored in localStorage, use IndexedDB.
let _cachedHandle = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("ritmol_sync_v1", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandleToDB(handle) {
  try {
    const db = await openDB();
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, HANDLE_LS_KEY);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch { /* silently ignore — handle won't persist across sessions */ }
}

async function loadHandleFromDB() {
  try {
    const db = await openDB();
    const tx = db.transaction("handles", "readonly");
    const req = tx.objectStore("handles").get(HANDLE_LS_KEY);
    return await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => rej(req.error);
    });
  } catch { return null; }
}

async function clearHandleFromDB() {
  try {
    const db = await openDB();
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").delete(HANDLE_LS_KEY);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch { /* ignore */ }
}

// ── Build sync payload from localStorage ─────────────────────────
function buildPayload() {
  const payload = { _schemaVersion: SYNC_SCHEMA_VERSION };
  for (const key of SYNC_KEYS) {
    const stored = LS.get(storageKey(key));
    if (stored !== null && stored !== undefined) {
      payload[key] = stored;
    }
  }
  return payload;
}

// ── Apply validated payload to localStorage ───────────────────────
function applyPayload(payload) {
  for (const key of SYNC_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const val = payload[key];
      const validator = SYNC_VALIDATORS[key];
      if (validator && !validator(val)) continue; // skip invalid values
      if (!isSafeSyncValue(val)) continue;        // skip dangerous values
      LS.set(storageKey(key), val);
    }
  }
}

// ── Parse and validate incoming JSON text ─────────────────────────
function parseAndValidate(text) {
  assertPayloadSize(text);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("CORRUPT_FILE");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("CORRUPT_FILE");
  }
  // Fix: the previous check `DANGEROUS_KEYS.has("__proto__")` was always true
  // (a dead condition). The actual guard is isSafeSyncValue which traverses the
  // entire payload tree looking for dangerous keys.
  if (!isSafeSyncValue(payload)) {
    throw new Error("CORRUPT_FILE");
  }
  const schemaVersion = payload._schemaVersion;
  // Fix: also reject schemaVersion < 1 (zero, negative, or NaN) — only positive
  // integer values up to SYNC_SCHEMA_VERSION are valid.
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion) ||
      schemaVersion < 1 || schemaVersion > SYNC_SCHEMA_VERSION) {
    throw new Error("SYNC_SCHEMA_OUTDATED");
  }
  return payload;
}

// ── Read geminiKey / googleClientId into sessionStorage ───────────
function extractSecretsFromPayload(payload) {
  if (typeof payload.geminiKey === "string" && payload.geminiKey.trim()) {
    setGeminiApiKey(payload.geminiKey.trim());
  }
  // googleClientId is intentionally not stored here — it would be
  // placed in a dedicated session key if implemented.
}

// ── SyncManager public API ────────────────────────────────────────
export const SyncManager = {
  /** Returns the current FileSystemFileHandle, or null if none linked. */
  async getHandle() {
    if (_cachedHandle) return _cachedHandle;
    _cachedHandle = await loadHandleFromDB();
    return _cachedHandle;
  },

  /** Open a file picker and persist the chosen handle. */
  async pickFile() {
    if (!FSAPI_SUPPORTED) throw new Error("FSAPI_NOT_SUPPORTED");
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "RITMOL data", accept: { "application/json": [".json"] } }],
      multiple: false,
    });
    _cachedHandle = handle;
    await saveHandleToDB(handle);
    return handle;
  },

  /** Write current localStorage state to the linked sync file. */
  async push() {
    const handle = await SyncManager.getHandle();
    if (!handle) throw new Error("NO_HANDLE");

    let perm;
    try {
      perm = await handle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        perm = await handle.requestPermission({ mode: "readwrite" });
      }
    } catch {
      throw new Error("PERMISSION_DENIED");
    }
    if (perm !== "granted") throw new Error("PERMISSION_DENIED");

    const payload = buildPayload();
    const text = JSON.stringify(payload, null, 2);
    assertPayloadSize(text);

    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();

    const ts = Date.now();
    return ts;
  },

  /** Read the linked sync file and apply it to localStorage. */
  async pull() {
    const handle = await SyncManager.getHandle();
    if (!handle) throw new Error("NO_HANDLE");

    const file = await handle.getFile();
    const text = await file.text();
    const payload = parseAndValidate(text);
    extractSecretsFromPayload(payload);
    applyPayload(payload);

    const ts = Date.now();
    return ts;
  },

  /** Import from a file picker (fallback for browsers without FSAPI write). */
  async importFile(file) {
    const text = await file.text();
    const payload = parseAndValidate(text);
    extractSecretsFromPayload(payload);
    applyPayload(payload);
    return Date.now();
  },

  /** Download current state as a JSON file (fallback for browsers without FSAPI write). */
  download() {
    const payload = buildPayload();
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ritmol-data.json";
    // Fix: append the anchor to the document before clicking — detached anchors are
    // silently ignored by Firefox and some other browsers, causing the download to
    // never start. Remove after click so it doesn't linger in the DOM.
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  /** Forget the linked sync file handle. */
  async forget() {
    _cachedHandle = null;
    await clearHandleFromDB();
  },
};
