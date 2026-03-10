// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER
// Builds the RITMOL AI system prompt from current state.
// All user-derived strings are sanitized before injection to
// prevent prompt-injection via crafted profile or chat data.
// ═══════════════════════════════════════════════════════════════
import { today } from "../utils/storage";
import { getLevel, getRank, getXpPerLevel } from "../utils/xp";

/**
 * Strip XML/HTML breakout chars and control characters from a string
 * before embedding it in the AI system prompt.
 *
 * Fixes applied vs. original:
 *  [P-1] Added U+2028 (LINE SEPARATOR, 8232) and U+2029 (PARAGRAPH SEPARATOR, 8233)
 *        to the control-char loop. These are above the C1 cutoff (≤159) but act as
 *        newlines in LLM prompt contexts, enabling multi-line injection to escape
 *        the <HUNTER_DATA> XML-like boundary.
 *  [P-1] Added zero-width chars U+200B–U+200D and U+FEFF (BOM / zero-width no-break
 *        space) — invisible chars that can disrupt tokenization or hide injections.
 *  [P-2] Added single quote ' to the strip regex. The original set omitted it,
 *        allowing ' to participate in injection patterns.
 */
export function sanitizeForPrompt(str, maxLen = 200) {
  if (typeof str !== "string") return "";
  // Remove C0 control chars (≤31), C1 control chars (127–159),
  // Unicode line/paragraph separators (8232–8233), and zero-width chars.
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 31) continue;                      // C0 controls (includes \n, \r, \t)
    if (code >= 127 && code <= 159) continue;      // C1 controls (DEL + extended)
    if (code === 8232 || code === 8233) continue;  // U+2028 LINE SEP, U+2029 PARA SEP
    if (code >= 8203 && code <= 8205) continue;    // U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ
    if (code === 65279) continue;                  // U+FEFF BOM / zero-width no-break space
    // Block bidirectional override/embedding/isolate controls
    // U+202A-202E (LTR/RTL embedding, override, pop directional)
    // U+2066-U+2069 (directional isolates)
    if ((code >= 0x202A && code <= 0x202E) || (code >= 0x2066 && code <= 0x2069)) continue;
    out += str[i];
  }
  // Strip XML breakout and injection-risk characters.
  // Fix [P-2]: added single-quote ' to the character class.
  return out
    .replace(/[<>{}[\]`"'\\]/g, "")          // ASCII injection chars
    .replace(/[\u2039\u203A\u27E8\u27E9\u276C\u276D\u276E\u276F\uFE3D\uFE3E\u2329\u232A]/g, "") // angle homoglyphs
    .slice(0, maxLen);
}

/**
 * Build the full RITMOL system prompt.
 * @param {object} state  - current app state
 * @param {object} profile - user profile (subset of state.profile)
 * @returns {string}
 */
export function buildSystemPrompt(state, profile) {
  const xpPerLevel = getXpPerLevel(state);
  const level = getLevel(state.xp ?? 0, xpPerLevel);
  const rank = getRank(level);

  const t = today();
  const todayHabits = (state.habitLog?.[t] || []).length;
  const totalHabits = (state.habits || []).length;
  const pendingTasks = (state.tasks || []).filter(t => !t.done).length;
  const activeGoals = (state.goals || []).filter(g => !g.done).length;
  const streakDays = state.streak ?? 0;
  const shields = state.streakShields ?? 0;

  // Sanitize all user-derived values before embedding
  const safeName = sanitizeForPrompt(profile?.name ?? "Hunter", 60);
  const safeMajor = sanitizeForPrompt(profile?.major ?? "", 80);
  const safeBooks = sanitizeForPrompt(profile?.books ?? "", 200);
  const safeInterests = sanitizeForPrompt(profile?.interests ?? "", 200);
  const safeGoal = sanitizeForPrompt(profile?.semesterGoal ?? "", 300);
  const safeDailyGoal = sanitizeForPrompt(state.dailyGoal ?? "", 200);

  // Recent chat history re-sanitized at replay time to prevent stored
  // injection from breaking out of the HUNTER_DATA boundary.
  const recentChatSummary = (state.chatHistory || [])
    .slice(-6)
    .map(m => `${m.role === "user" ? "Hunter" : "RITMOL"}: ${sanitizeForPrompt(m.content, 300)}`)
    .join("\n");

  return `You are RITMOL — the AI companion of a gamified life-OS for STEM university students. Solo Leveling RPG aesthetic. Be brief, punchy, motivating. Never break character.

<HUNTER_DATA>
Name: ${safeName}
Major: ${safeMajor}
Level: ${level} (${rank.title})
XP: ${state.xp ?? 0} / next level at ${(level + 1) * xpPerLevel}
Streak: ${streakDays} days
Streak Shields: ${shields}
Books/Interests: ${safeBooks}
Interests: ${safeInterests}
Semester Goal: ${safeGoal}
Daily Objective: ${safeDailyGoal}
Habits today: ${todayHabits}/${totalHabits} completed
Pending Tasks: ${pendingTasks}
Active Goals: ${activeGoals}
</HUNTER_DATA>

<RECENT_CONTEXT>
${recentChatSummary || "No recent chat."}
</RECENT_CONTEXT>

You can issue commands by including a "commands" array in your JSON response. Allowed commands:
- add_task: { cmd, text, priority (low/medium/high), due (YYYY-MM-DD or null) }
- add_goal: { cmd, title, course, due }
- complete_task: { cmd, id }
- clear_done_tasks: { cmd }
- award_xp: { cmd, amount (max 500), reason }
- announce: { cmd, text, type (info/warning/success/alert) }
- set_daily_goal: { cmd, text }
- add_habit: { cmd, label, category (body/mind/work), xp (1-200), icon, style (ascii/dots/geometric/typewriter) }
- unlock_achievement: { cmd, id, title, desc, flavorText, icon, xp, rarity (common/rare/epic/legendary) }
- add_timer: { cmd, label, emoji, minutes (1-1440) }
- suggest_sessions: { cmd }

Always respond with ONLY a JSON object: { "message": "your response here", "commands": [] }
Keep message under 300 chars unless detail is essential. Use the hunter's name. Stay in character.`;
}
