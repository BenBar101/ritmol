// Compatibility re-export layer: all symbols live in db.js.
// Existing imports from ./storage continue to work via this file.
// Safe to remove once all callers have been updated to import from ./db directly.
export {
  LS,
  storageKey,
  today,
  todayUTC,
  localDateFromUTC,
  localHour,
  localMin,
  nowHour,
  nowMin,
  sanitizeForDisplay,
  IS_DEV,
  DEV_PREFIX,
  APP_ICON_URL,
  getGeminiApiKey,
  setGeminiApiKey,
  getMaxDateSeen,
  updateMaxDateSeen,
} from "./db";

