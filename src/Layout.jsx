import { APP_ICON_URL } from "./utils/storage";
import { getLevelProgress } from "./utils/xp";

// ═══════════════════════════════════════════════════════════════
// TOP BAR
// ═══════════════════════════════════════════════════════════════
// eslint-disable-next-line no-unused-vars
export function TopBar({ xp, xpPerLevel, level, rank, streak, profile, syncStatus, lastSynced, onPush, onPull, syncFileConnected, isReloading = false }) {
  const progress = getLevelProgress(xp, xpPerLevel);
  const pct = xpPerLevel > 0
    ? Math.min(100, Math.max(0, (progress / xpPerLevel) * 100))
    : 0;

  const syncTitle = lastSynced ? `Last synced: ${new Date(lastSynced).toLocaleTimeString()}` : "Not synced yet";

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
      background: "#000", borderBottom: "3px solid #fff",
      padding: "8px 16px", height: "56px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <img src={APP_ICON_URL} alt="" style={{ width: 28, height: 28, display: "block" }} />
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "16px", letterSpacing: "3px", color: "#fff" }}>
          RITMOL
        </span>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "13px", color: "#ccc" }}>
          {rank.decor}
        </span>
      </div>

      <div style={{ flex: 1, margin: "0 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#fff", marginBottom: "2px", fontFamily: "'Share Tech Mono', monospace", fontWeight: "bold" }}>
          <span>LV.{level} {rank.title}</span>
          <span>{getLevelProgress(xp, xpPerLevel)}/{xpPerLevel}</span>
        </div>
        <div style={{ height: "5px", background: "#333", position: "relative" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#fff" }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {syncFileConnected && (
          <>
            <button
              type="button"
              onClick={onPull}
              disabled={syncStatus === "syncing" || (typeof navigator !== "undefined" && navigator.onLine === false) || isReloading}
              title={`Pull from Syncthing file · ${syncTitle}`}
              style={{
                fontFamily: "'Share Tech Mono', monospace", fontSize: "16px",
                color: (syncStatus === "syncing" || (typeof navigator !== "undefined" && navigator.onLine === false) || isReloading) ? "#555" : "#fff",
                background: "none", border: "1px solid #555", padding: "6px 10px",
                cursor: (syncStatus === "syncing" || (typeof navigator !== "undefined" && navigator.onLine === false) || isReloading) ? "default" : "pointer",
                minHeight: "48px", minWidth: "48px",
              }}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onPush}
              disabled={syncStatus === "syncing" || (typeof navigator !== "undefined" && navigator.onLine === false) || isReloading}
              title={`Push to Syncthing file · ${syncTitle}`}
              style={{
                fontFamily: "'Share Tech Mono', monospace", fontSize: "16px",
                color: (syncStatus === "syncing" || (typeof navigator !== "undefined" && navigator.onLine === false) || isReloading) ? "#555" : "#fff",
                background: "none", border: "1px solid #555", padding: "6px 10px",
                cursor: (syncStatus === "syncing" || (typeof navigator !== "undefined" && navigator.onLine === false) || isReloading) ? "default" : "pointer",
                minHeight: "48px", minWidth: "48px",
              }}
            >
              {syncStatus === "syncing" ? "..." : "↑"}
            </button>
          </>
        )}
        <div style={{
          fontFamily: "'Share Tech Mono', monospace", fontSize: "14px",
          border: "2px solid #fff", padding: "8px 12px", color: "#fff", fontWeight: "bold",
        }}>
          🔥{streak}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BOTTOM NAV
// ═══════════════════════════════════════════════════════════════
export function BottomNav({ tab, setTab }) {
  const tabs = [
    { id: "home", icon: "⌂", label: "HOME" },
    { id: "habits", icon: "◉", label: "HABITS" },
    { id: "tasks", icon: "▣", label: "TASKS" },
    { id: "chat", icon: "◈", label: "RITMOL" },
    { id: "profile", icon: "§", label: "PROFILE" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: "#000", borderTop: "3px solid #fff",
      display: "flex", height: "72px",
    }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: "4px",
            background: tab === t.id ? "#fff" : "none", border: "none",
            borderTop: tab === t.id ? "3px solid #fff" : "3px solid #444",
            color: tab === t.id ? "#000" : "#ccc",
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          <span style={{ fontSize: "22px" }}>{t.icon}</span>
          <span style={{ fontSize: "12px", letterSpacing: "1px", fontWeight: "bold" }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BANNER
// ═══════════════════════════════════════════════════════════════
export function Banner({ banner, onClose }) {
  const bgColors = { info: "#222", warning: "#444", success: "#000", alert: "#000" };
  const safeBannerText = (typeof banner.text === "string")
    // eslint-disable-next-line no-control-regex
    ? banner.text.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069]/g, "").slice(0, 300)
    : "";
  return (
    <div style={{
      position: "fixed", top: "56px", left: 0, right: 0, zIndex: 500,
      background: bgColors[banner.type] || "#000", borderBottom: "3px solid #fff", borderTop: "3px solid #fff",
      padding: "14px 16px", display: "flex", justifyContent: "space-between",
      alignItems: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: "16px", fontWeight: "bold",
    }}>
      <span style={{ color: "#fff", flex: 1 }}>{safeBannerText}</span>
      <button onClick={onClose} style={{ color: "#fff", fontSize: "20px", minHeight: "48px", minWidth: "48px", background: "none", border: "none" }}>×</button>
    </div>
  );
}
