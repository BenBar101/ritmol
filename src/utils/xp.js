import { DEFAULT_XP_PER_LEVEL, DEFAULT_GACHA_COST, DEFAULT_STREAK_SHIELD_COST, RANKS, FOCUS_LEVELS, SESSION_TYPES } from "../constants";

// ═══════════════════════════════════════════════════════════════
// XP & LEVEL UTILS
// ═══════════════════════════════════════════════════════════════

// Fix [X-1]: Guard against xpPerLevel = 0 or non-finite values.
// Math.floor(xp / 0) = Infinity. The sync validator for jv_dynamic_costs requires
// xpPerLevel >= 200, but initState reads dynamicCosts without re-validation if the
// value was written by an older app version or a direct localStorage edit.
// Fallback to DEFAULT_XP_PER_LEVEL (1000) if the value is unusable.
function safeXpPerLevel(xpPerLevel) {
  return typeof xpPerLevel === "number" && isFinite(xpPerLevel) && xpPerLevel > 0
    ? xpPerLevel
    : DEFAULT_XP_PER_LEVEL;
}

export function getLevel(xp, xpPerLevel = DEFAULT_XP_PER_LEVEL) {
  const safeXpl = safeXpPerLevel(xpPerLevel);
  const safeXp = typeof xp === "number" && isFinite(xp) ? Math.max(0, xp) : 0;
  return Math.floor(safeXp / safeXpl);
}

export function getLevelProgress(xp, xpPerLevel = DEFAULT_XP_PER_LEVEL) {
  const safeXpl = safeXpPerLevel(xpPerLevel);
  const safeXp = typeof xp === "number" && isFinite(xp) ? Math.max(0, xp) : 0;
  return safeXp % safeXpl;
}

export function getRank(level) {
  // Fix [X-1]: guard against Infinity/NaN level (produced if xpPerLevel were ever 0).
  const safeLevel = typeof level === "number" && isFinite(level) ? level : 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (safeLevel >= RANKS[i].min) return RANKS[i];
  }
  return RANKS[0];
}

export function calcSessionXP(type, durationMins, focusId, streakDays) {
  const sType = SESSION_TYPES.find((s) => s.id === type) || SESSION_TYPES[0];
  const focus = FOCUS_LEVELS.find((f) => f.id === focusId) || FOCUS_LEVELS[1];
  const base = sType.baseXP * focus.mult;
  // Fix: clamp durationMins to a reasonable max (600 min = 10 h) so an unexpectedly
  // large value (e.g. from a corrupted sync file or UI bug) can't award runaway XP.
  const safeDuration = Math.min(Math.max(0, Number(durationMins) || 0), 600);
  const durationBonus = Math.floor(safeDuration / 30) * 10;
  // Fix [X-1]: guard against non-finite streakDays (e.g. if streak were corrupted).
  const safeStreak = typeof streakDays === "number" && isFinite(streakDays) ? streakDays : 0;
  const streakBonus = safeStreak >= 7 ? 1.5 : safeStreak >= 3 ? 1.25 : 1.0;
  return Math.round((base + durationBonus) * streakBonus);
}

export function getXpPerLevel(state) { return safeXpPerLevel(state.dynamicCosts?.xpPerLevel ?? DEFAULT_XP_PER_LEVEL); }
export function getGachaCost(state) { return state.dynamicCosts?.gachaCost ?? DEFAULT_GACHA_COST; }
export function getStreakShieldCost(state) { return state.dynamicCosts?.streakShieldCost ?? DEFAULT_STREAK_SHIELD_COST; }
