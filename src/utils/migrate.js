// src/utils/migrate.js
// ═══════════════════════════════════════════════════════════════
// One-shot migration: localStorage → IndexedDB
//
// Called during async boot in useAppState AFTER idbGetAll() has
// populated the IDB cache. If IDB is empty but localStorage has
// jv_profile (i.e. an existing user), we copy all IDB_KEYS from
// localStorage into IDB, then delete them from localStorage.
//
// The migration is idempotent: if IDB already has data (idbGet
// returns non-null for jv_profile), it is a no-op.
//
// A migration-complete flag ("jv_idb_migrated") is written to
// localStorage (NOT IDB) so we never attempt migration again even
// if the IDB store is later cleared.
// ═══════════════════════════════════════════════════════════════

import { LS, storageKey, IS_DEV, DEV_PREFIX, todayUTC } from "./storage";
import { idbGet, idbSet, idbGetAll } from "./db";

const MIGRATION_FLAG_KEY = IS_DEV ? `${DEV_PREFIX}jv_idb_migrated` : "jv_idb_migrated";

export async function migrateLocalStorageToIdb() {
  // Already migrated
  const migrated = localStorage.getItem(MIGRATION_FLAG_KEY);
  const cleanupPending = localStorage.getItem(`${MIGRATION_FLAG_KEY}_cleanup_pending`) === "1";
  if (migrated === "1" && !cleanupPending) return;

  // IDB already has a profile — nothing to migrate (new install or already migrated)
  const idbProfile = idbGet(storageKey("jv_profile"), null);
  if (idbProfile !== null) {
    // If cleanup was pending and IDB has a profile, we can safely clear
    // any leftover localStorage copies.
    if (cleanupPending) {
      const keys = Object.keys(await idbGetAll());
      for (const key of keys) {
        LS.del(key);
      }
      localStorage.removeItem(`${MIGRATION_FLAG_KEY}_cleanup_pending`);
    } else if (migrated !== "1") {
      localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    }
    return;
  }

  // Check if localStorage has a profile (existing user)
  const lsProfile = LS.get(storageKey("jv_profile"), null);
  if (lsProfile === null) {
    // New user — no migration needed
    localStorage.setItem(MIGRATION_FLAG_KEY, "1");
    return;
  }

  console.info("[RITMOL] Migrating data from localStorage to IndexedDB…");

  // Copy every old jv_* key from localStorage into TinyBase store
  for (let i = 0; i < localStorage.length; i += 1) {
    const rawKey = localStorage.key(i);
    if (!rawKey || !rawKey.startsWith("jv_")) continue;
    const key = rawKey;
    const prefixed = storageKey(key);
    let value    = LS.get(prefixed, null);
    if (value !== null) {
      // One-off habit-log migration: if the user previously logged today's habits
      // under a local-date key that differs from todayUTC(), re-key that single
      // entry so missions and streak logic (which use UTC) continue to see it.
      if (key === "jv_habit_log" && value && typeof value === "object") {
        const localToday = new Date().toLocaleDateString("en-CA");
        const utcToday = todayUTC();
        if (localToday !== utcToday && value[localToday] && !value[utcToday]) {
          value = { ...value, [utcToday]: value[localToday] };
        }
      }
      idbSet(prefixed, value);
    }
  }

  // Mark migration complete — keep LS data as backup for one more session.
  localStorage.setItem(MIGRATION_FLAG_KEY, "1");
  localStorage.setItem(`${MIGRATION_FLAG_KEY}_cleanup_pending`, "1");
  console.info("[RITMOL] Migration complete.");
}

