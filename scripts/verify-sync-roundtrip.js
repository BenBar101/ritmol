/**
 * Verifies sync round-trip for string values (e.g. jv_daily_goal).
 * Ensures we get back a plain string, not "\"wrapped in extra quotes\"".
 * Run: node scripts/verify-sync-roundtrip.js
 */

// Mimic LS behavior (same as App.jsx)
const storage = {};
const LS = {
  get: (k, def = null) => {
    try {
      const v = storage[k];
      return v != null ? JSON.parse(v) : def;
    } catch {
      return def;
    }
  },
  set: (k, v) => {
    try {
      storage[k] = JSON.stringify(v);
    } catch {
      /* ignore serialization errors */
    }
  },
};

const SYNC_KEYS = ["jv_daily_goal", "jv_last_login"];
const SYNC_VALIDATORS = {
  jv_daily_goal: (v) => typeof v === "string" && v.length <= 500,
  jv_last_login: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v),
};

function parseSyncValue(k, v) {
  if (typeof v !== "string") return v;
  if (!SYNC_VALIDATORS[k]) return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

// 1) Simulate app writing a string via LS.set (as in persist effect)
const dailyGoal = "Finish the report";
LS.set("jv_daily_goal", dailyGoal);

// 2) buildSyncPayload: raw localStorage values (what we send to Dropbox)
const payload = {};
SYNC_KEYS.forEach((k) => {
  const v = storage[k];
  if (v !== undefined) payload[k] = v;
});

// Raw value for a string is JSON-encoded (one level)
console.log("After LS.set, raw storage[jv_daily_goal]:", JSON.stringify(payload.jv_daily_goal));

// 3) Upload: body = JSON.stringify(payload); Download: remote = JSON.parse(body)
const uploadBody = JSON.stringify(payload);
const remote = JSON.parse(uploadBody);

// 4) applySyncPayload: parseSyncValue then LS.set
const allowedSet = new Set(SYNC_KEYS);
Object.entries(remote).forEach(([k, v]) => {
  if (!allowedSet.has(k)) return;
  const value = parseSyncValue(k, v);
  const validator = SYNC_VALIDATORS[k];
  if (validator && !validator(value)) return;
  LS.set(k, value);
});

// 5) Read back via LS.get (as initState does)
const roundTripped = LS.get("jv_daily_goal", "");

const isPlainString = roundTripped === dailyGoal && typeof roundTripped === "string";
const isDoubleQuoted =
  typeof roundTripped === "string" && roundTripped.startsWith('"') && roundTripped.endsWith('"');

if (isPlainString) {
  console.log("OK: jv_daily_goal round-trips as plain string:", roundTripped);
} else if (isDoubleQuoted) {
  console.error("FAIL: jv_daily_goal is double-serialized (extra quotes):", roundTripped);
  process.exit(1);
} else {
  console.error("FAIL: unexpected value:", roundTripped);
  process.exit(1);
}

// Also verify jv_last_login (date string)
storage["jv_last_login"] = JSON.stringify("2025-03-08");
const payload2 = { jv_last_login: storage["jv_last_login"] };
const remote2 = JSON.parse(JSON.stringify(payload2));
Object.entries(remote2).forEach(([k, v]) => {
  if (!allowedSet.has(k)) return;
  const value = parseSyncValue(k, v);
  const validator = SYNC_VALIDATORS[k];
  if (validator && !validator(value)) return;
  LS.set(k, value);
});
const roundTrippedLogin = LS.get("jv_last_login", "");
if (roundTrippedLogin !== "2025-03-08") {
  console.error("FAIL: jv_last_login round-trip:", roundTrippedLogin);
  process.exit(1);
}
console.log("OK: jv_last_login round-trips as plain string:", roundTrippedLogin);

console.log("Sync round-trip verification passed.");
