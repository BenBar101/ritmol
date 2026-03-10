// src/utils/idb.js
// ═══════════════════════════════════════════════════════════════
// IndexedDB key-value store for RITMOL runtime data.
//
// Design contract:
//  • get(key)        — synchronous read from in-memory cache (populated at boot)
//  • set(key, value) — synchronous cache write + fire-and-forget IDB put
//  • del(key)        — synchronous cache delete + fire-and-forget IDB delete
//  • getAll()        — async bulk read from IDB; populates cache; called ONCE at boot
//  • clear(keys)     — async bulk delete of specific keys (used by resetAll & migration)
//  • isAvailable()   — returns true if IDB is usable in this browser/context
//
// Fallback: if IDB open fails (Firefox private mode, quota policies),
// _idbAvailable is set false and every operation silently delegates to LS.
//
// Dev/prod isolation: in IS_DEV mode all keys are prefixed with "ritmol_dev_"
// — the same rule as storageKey() in storage.js — so dev and prod IDB stores
// never share data.
// ═══════════════════════════════════════════════════════════════

import { IS_DEV, LS } from "./storage";

const DB_NAME    = IS_DEV ? "ritmol_dev" : "ritmol";
const DB_VERSION = 1;
const STORE_NAME = "kv"; // single object store, key = string, value = any JSON-serialisable value

// In-memory cache — populated by getAll() at boot, kept in sync by set/del.
// This makes get() synchronous throughout the app lifecycle after boot.
const _cache = new Map();

let _db          = null;   // IDBDatabase instance once opened
let _idbAvailable = true;  // set false if open fails
let _openPromise  = null;  // singleton open promise — never open twice

// ── Open (singleton) ──────────────────────────────────────────
function _openDB() {
  if (_openPromise) return _openPromise;
  _openPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => {
        _db = req.result;
        // Handle unexpected close (browser killed the DB)
        _db.onclose = () => { _db = null; _openPromise = null; };
        resolve(_db);
      };
      req.onerror  = () => reject(req.error);
      req.onblocked = () => reject(new Error("IDB blocked"));
    } catch (e) {
      reject(e);
    }
  });
  _openPromise.catch(() => {
    _idbAvailable = false;
    _openPromise  = null;
  });
  return _openPromise;
}

// ── isAvailable ───────────────────────────────────────────────
export function isIdbAvailable() { return _idbAvailable; }

// ── getAll (async, called once at boot) ───────────────────────
// Returns a plain object { [rawKey]: parsedValue } for all keys stored in IDB.
// Also populates the in-memory cache so subsequent get() calls are synchronous.
export async function idbGetAll() {
  if (!_idbAvailable) return {};
  try {
    const db = await _openDB();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, "readonly");
      // We need both keys and values — use openCursor
      const result = {};
      const cursorReq = tx.objectStore(STORE_NAME).openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          result[cursor.key] = cursor.value;
          _cache.set(cursor.key, cursor.value);
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch (e) {
    console.warn("[IDB] getAll failed, falling back to LS:", e);
    _idbAvailable = false;
    return {};
  }
}

// ── get (synchronous — reads from cache) ─────────────────────
// IMPORTANT: only reliable after idbGetAll() has resolved at boot.
// Before boot completes, returns undefined (caller must provide default).
export function idbGet(key, def = null) {
  if (!_idbAvailable) return LS.get(key, def);
  return _cache.has(key) ? _cache.get(key) : def;
}

// ── set (sync cache update + async IDB write) ─────────────────
export function idbSet(key, value) {
  // Update cache synchronously so subsequent idbGet() sees the new value
  // in the same event-loop turn (critical for write-through correctness).
  _cache.set(key, value);

  if (!_idbAvailable) {
    LS.set(key, value);
    return;
  }

  // Fire-and-forget IDB write — we don't await this so the React updater
  // is not blocked. If it fails (quota, etc.) we log but don't throw.
  _openDB().then((db) => {
    const tx  = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onerror = () => {
      console.warn("[IDB] put failed for key:", key, req.error);
      // On quota error dispatch the same event the LS wrapper used so the
      // existing App.jsx banner handler fires.
      if (req.error?.name === "QuotaExceededError") {
        window.dispatchEvent(new CustomEvent("ls-quota-exceeded"));
      }
    };
  }).catch((e) => {
    console.warn("[IDB] set open failed:", e);
    // Fallback: write to LS so the value is not lost
    LS.set(key, value);
  });
}

// ── del (sync cache delete + async IDB delete) ────────────────
export function idbDel(key) {
  _cache.delete(key);
  if (!_idbAvailable) { LS.del(key); return; }
  _openDB().then((db) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
  }).catch(() => { LS.del(key); });
}

// ── clear (async bulk delete — used by resetAll and migration) ─
export async function idbClear(keys) {
  // Always clear from cache first
  keys.forEach((k) => _cache.delete(k));
  if (!_idbAvailable) {
    keys.forEach((k) => LS.del(k));
    return;
  }
  try {
    const db = await _openDB();
    await new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      keys.forEach((k) => store.delete(k));
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[IDB] clear failed:", e);
    keys.forEach((k) => LS.del(k));
  }
}

// ── clearAll (async wipe entire store — used by resetAll) ──────
export async function idbClearAll() {
  _cache.clear();
  if (!_idbAvailable) return;
  try {
    const db = await _openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[IDB] clearAll failed:", e);
  }
}

