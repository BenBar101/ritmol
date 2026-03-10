import { storageKey, today } from "./storage";
import { idbGet, idbSet } from "./idb";
import { DEFAULT_XP_PER_LEVEL, DEFAULT_GACHA_COST, DEFAULT_STREAK_SHIELD_COST, DEFAULT_HABITS } from "../constants";

// ─────────────────────────────────────────────────────────────────
// Safe numeric read helper
// Fix [ST-1]: LS.get can return NaN, null, Infinity, or a string for numeric keys
// if the stored value was corrupted by a previous bug or a crafted sync file that
// slipped past validators. Reading such values raw and doing arithmetic on them
// (e.g. xp + amount) permanently corrupts state.
//   safeNum(v, min, max, fallback) — clamps to [min, max]; returns fallback if
//   the value is not a finite number.
// ─────────────────────────────────────────────────────────────────
function safeNum(v, min, max, fallback) {
  if (typeof v === "number" && isFinite(v) && v >= min && v <= max) return v;
  // Accept coercible-to-number strings (e.g. "42") written by old code versions.
  const n = Number(v);
  if (isFinite(n) && n >= min && n <= max) return n;
  return fallback;
}

// Safe numeric flush helper — prevents NaN / Infinity from reaching localStorage.
// Used by flushStateToStorage for numeric fields that flow through awardXP or
// streak math.
function safeFlushNum(v, min, max, fallback) {
  return safeNum(v, min, max, fallback);
}

// ═══════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════
export function initState() {
  return {
    profile: idbGet(storageKey("jv_profile"), null),
    // Fix [ST-1]: clamp numeric values so a corrupt localStorage entry
    // (NaN, Infinity, negative) does not propagate into React state.
    xp:           safeNum(idbGet(storageKey("jv_xp"),      0), 0, 100_000_000, 0),
    streak:       safeNum(idbGet(storageKey("jv_streak"),   0), 0, 3650,        0),
    streakShields:safeNum(idbGet(storageKey("jv_shields"),  0), 0, 10000,       0),
    lastLoginDate: idbGet(storageKey("jv_last_login"), null),
    habits: idbGet(storageKey("jv_habits"), DEFAULT_HABITS),
    habitLog: idbGet(storageKey("jv_habit_log"), {}), // { "YYYY-MM-DD": ["habitId",...] }
    tasks: idbGet(storageKey("jv_tasks"), []),
    goals: idbGet(storageKey("jv_goals"), []),
    sessions: idbGet(storageKey("jv_sessions"), []),
    achievements: idbGet(storageKey("jv_achievements"), []),
    gachaCollection: idbGet(storageKey("jv_gacha"), []),
    calendarEvents: idbGet(storageKey("jv_cal_events"), []),
    chatHistory: idbGet(storageKey("jv_chat"), []),
    dailyGoal: idbGet(storageKey("jv_daily_goal"), ""),
    activeTimers: idbGet(storageKey("jv_timers"), []),
    sleepLog: idbGet(storageKey("jv_sleep_log"), {}),
    screenTimeLog: idbGet(storageKey("jv_screen_log"), {}),
    dailyMissions: idbGet(storageKey("jv_missions"), null),
    lastMissionDate: idbGet(storageKey("jv_mission_date"), null),
    pendingHabitSuggestions: idbGet(storageKey("jv_habit_suggestions"), []),
    chronicles: idbGet(storageKey("jv_chronicles"), []),
    gCalConnected: idbGet(storageKey("jv_gcal_connected"), false),
    // Fix [ST-2]: include aiXpToday: 0 and warnedAt: [] in the default so
    // consuming code (consumeAiXpBudget, trackTokens) always sees a fully-formed
    // object and never reads undefined.aiXpToday.
    tokenUsage: idbGet(storageKey("jv_token_usage"), { date: today(), tokens: 0, aiXpToday: 0, warnedAt: [] }),
    habitsInitialized: idbGet(storageKey("jv_habits_init"), false),
    dynamicCosts: idbGet(storageKey("jv_dynamic_costs"), null) || { xpPerLevel: DEFAULT_XP_PER_LEVEL, gachaCost: DEFAULT_GACHA_COST, streakShieldCost: DEFAULT_STREAK_SHIELD_COST },
    lastShieldUseDate: idbGet(storageKey("jv_last_shield_use_date"), null),
    lastShieldBuyDate: idbGet(storageKey("jv_last_shield_buy_date"), null),
    syncFileConnected: false, // updated async after mount by SyncManager.getHandle()
  };
}

// ═══════════════════════════════════════════════════════════════
// FLUSH STATE → LOCALSTORAGE
// ═══════════════════════════════════════════════════════════════
// Single authoritative function so no state field is ever missed in sync paths.
export function flushStateToStorage(s) {
  if (!s?.profile) return;
  // eslint-disable-next-line no-unused-vars
  const { geminiKey: _stripped, ...profileToSave } = s.profile;
  idbSet(storageKey("jv_profile"),           profileToSave);
  // Fix [ST-1]: clamp numeric values before writing to localStorage.
  // If awardXP somehow received a bad amount (e.g. from a corrupted habit.xp),
  // state.xp could be NaN. Writing NaN to localStorage persists the corruption
  // across sessions. safeFlushNum catches this and writes 0 instead.
  idbSet(storageKey("jv_xp"),                safeFlushNum(s.xp,            0, 100_000_000, 0));
  idbSet(storageKey("jv_streak"),            safeFlushNum(s.streak,        0, 3650,        0));
  idbSet(storageKey("jv_shields"),           safeFlushNum(s.streakShields, 0, 10000,       0));
  idbSet(storageKey("jv_last_login"),        s.lastLoginDate);
  idbSet(storageKey("jv_habits"),            s.habits);
  idbSet(storageKey("jv_habit_log"),         s.habitLog);
  idbSet(storageKey("jv_tasks"),             s.tasks);
  idbSet(storageKey("jv_goals"),             s.goals);
  idbSet(storageKey("jv_sessions"),          s.sessions);
  idbSet(storageKey("jv_achievements"),      s.achievements);
  idbSet(storageKey("jv_gacha"),             s.gachaCollection);
  idbSet(storageKey("jv_cal_events"),        s.calendarEvents);
  idbSet(storageKey("jv_chat"),              s.chatHistory);
  idbSet(storageKey("jv_daily_goal"),        s.dailyGoal);
  idbSet(storageKey("jv_sleep_log"),         s.sleepLog);
  idbSet(storageKey("jv_screen_log"),        s.screenTimeLog);
  idbSet(storageKey("jv_missions"),          s.dailyMissions);
  idbSet(storageKey("jv_mission_date"),      s.lastMissionDate);
  idbSet(storageKey("jv_chronicles"),        s.chronicles);
  idbSet(storageKey("jv_token_usage"),       s.tokenUsage);
  idbSet(
    storageKey("jv_timers"),
    Array.isArray(s.activeTimers) ? s.activeTimers : [],
  );
  idbSet(
    storageKey("jv_habit_suggestions"),
    Array.isArray(s.pendingHabitSuggestions) ? s.pendingHabitSuggestions : [],
  );
  idbSet(storageKey("jv_gcal_connected"),    s.gCalConnected);
  idbSet(storageKey("jv_habits_init"),       s.habitsInitialized);
  if (s.dynamicCosts) idbSet(storageKey("jv_dynamic_costs"), s.dynamicCosts);
  // Always write lastShieldUseDate including null — null means "no shield used yet".
  idbSet(storageKey("jv_last_shield_use_date"), s.lastShieldUseDate ?? null);
  idbSet(storageKey("jv_last_shield_buy_date"), s.lastShieldBuyDate ?? null);
}
