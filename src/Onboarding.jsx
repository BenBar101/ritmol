import { useState, useMemo, useEffect } from "react";
import { STYLE_CSS } from "./constants";
import { sanitizeForPrompt } from "./api/systemPrompt";
import { getGeminiApiKey } from "./utils/db";
import { isAuthenticated } from "./api/dropbox";
import GeometricCorners from "./GeometricCorners";

export const primaryBtn = {
  width: "100%", marginTop: "20px", padding: "14px",
  background: "#fff", color: "#000",
  fontFamily: "'Share Tech Mono', monospace", fontSize: "14px", letterSpacing: "2px",
  border: "none", cursor: "pointer",
};

export function inputStyle(s) {
  return {
    width: "100%", background: "rgba(0,0,0,0.6)", border: "1px solid #444",
    color: "#e8e8e8", padding: "12px", fontSize: "15px",
    fontFamily: s.fontFamily, outline: "none", resize: "none",
    borderRadius: "0",
  };
}

// ── Dropbox step ──────────────────────────────────────────────
function DropboxOnboardingStep({ connectDropbox, onSkip, onAdvance }) {
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  // Check if we just returned from the Dropbox OAuth flow
  const [connected, setConnected] = useState(() => isAuthenticated());

  // Poll for auth on focus — handles the case where the user approved Dropbox
  // in the popup/tab and returned to this page.
  useEffect(() => {
    if (connected) return;
    const check = () => {
      if (isAuthenticated()) {
        setConnected(true);
        setConnecting(false);
      }
    };
    window.addEventListener("focus", check);
    // Also poll every 800ms while connecting so we catch the redirect-back case
    const interval = setInterval(check, 800);
    return () => {
      window.removeEventListener("focus", check);
      clearInterval(interval);
    };
  }, [connected]);

  // Auto-advance 1.2s after connection is confirmed so the user sees the ✓ state
  useEffect(() => {
    if (!connected) return;
    const t = setTimeout(() => onAdvance?.(), 1200);
    return () => clearTimeout(t);
  }, [connected, onAdvance]);

  function handleConnect() {
    setConnectError("");
    setConnecting(true);
    try {
      connectDropbox();
      // startOAuthFlow() navigates away — if we're still here after 3s,
      // something went wrong (popup blocked, key not configured, etc.)
      setTimeout(() => {
        if (!isAuthenticated()) {
          setConnecting(false);
        }
      }, 3000);
    } catch (e) {
      setConnecting(false);
      if (e?.message === "DROPBOX_NOT_CONFIGURED") {
        setConnectError("Dropbox is not configured in this build. Skip and enter your Gemini key manually.");
      } else {
        setConnectError("Could not start Dropbox connection. Try again.");
      }
    }
  }

  if (connected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", padding: "8px 0" }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          border: "2px solid #4caf50", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", color: "#4caf50",
        }}>✓</div>
        <div style={{ fontSize: "13px", color: "#4caf50", letterSpacing: "1px" }}>DROPBOX CONNECTED</div>
        <div style={{ fontSize: "10px", color: "#555", textAlign: "center" }}>
          Continuing to next step…
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "11px", color: "#888", lineHeight: "1.8" }}>
        Connect Dropbox to sync your data across devices and back it up automatically.
        Your Gemini API key will be stored securely in your Dropbox — configure once,
        use everywhere.
      </div>
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        style={{
          width: "100%", padding: "14px", border: "2px solid #fff",
          background: connecting ? "transparent" : "#fff",
          color: connecting ? "#888" : "#000",
          fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", letterSpacing: "2px",
          cursor: connecting ? "not-allowed" : "pointer",
          transition: "all 0.2s",
        }}
      >
        {connecting ? "OPENING DROPBOX…" : "CONNECT DROPBOX"}
      </button>
      {connectError && (
        <div style={{ color: "#c44", fontSize: "10px" }}>⚠ {connectError}</div>
      )}
      <div style={{ height: "1px", background: "#333" }} />
      <div style={{ fontSize: "10px", color: "#555", lineHeight: "1.6" }}>
        Already have a save file? Connecting Dropbox will pull it automatically.
        No account? You can skip this and sync manually later in Profile → Settings.
      </div>
      <button
        type="button"
        onClick={onSkip}
        style={{
          width: "100%", padding: "10px", border: "1px solid #444", background: "transparent", color: "#888",
          fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", letterSpacing: "1px", cursor: "pointer",
        }}
      >
        SKIP FOR NOW
      </button>
    </div>
  );
}

// ── Gemini key step ───────────────────────────────────────────
export function GeminiKeySetupScreen({ onSave }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");

  function handleSave() {
    const trimmed = key.trim();
    if (!/^AIza[A-Za-z0-9_-]{35,45}$/.test(trimmed)) {
      setError("Invalid key format. Get one free at aistudio.google.com/apikey");
      return;
    }
    setError("");
    onSave(trimmed);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "11px", color: "#888", lineHeight: "1.8" }}>
        Enter your Gemini API key to enable RITMOL&apos;s AI features.
        Get one free at aistudio.google.com/apikey
      </div>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="AIza..."
        maxLength={60}
        style={{
          width: "100%", padding: "12px", background: "rgba(0,0,0,0.6)", border: "1px solid #444",
          color: "#e8e8e8", fontSize: "14px", fontFamily: "'Share Tech Mono', monospace", outline: "none",
        }}
      />
      {error && <div style={{ color: "#c44", fontSize: "10px" }}>⚠ {error}</div>}
      <button
        type="button"
        onClick={handleSave}
        style={{
          width: "100%", padding: "14px", border: "2px solid #fff", background: "#fff", color: "#000",
          fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", letterSpacing: "2px", cursor: "pointer",
        }}
      >
        SAVE &amp; CONTINUE
      </button>
    </div>
  );
}

const BASE_URL = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "";
const APP_ICON_URL = `${BASE_URL}/icon-192.png`;

// ── Main onboarding ───────────────────────────────────────────
export default function Onboarding({ onComplete, onGeminiKeySaved, connectDropbox }) {
  // Snapshot API state once on mount so the step list stays stable
  // throughout the flow even if session storage changes mid-flow.
  const needsDropbox = useMemo(() => !isAuthenticated(), []);
  const needsGemini  = useMemo(() => !getGeminiApiKey(),  []);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", major: "", books: "", interests: "", semesterGoal: "" });
  const [error, setError] = useState("");

  // ── Build step list dynamically ──────────────────────────────
  const steps = useMemo(() => {
    const list = [];

    if (needsDropbox) {
      list.push({
        key: "_dropbox",
        title: "SYNC SETUP",
        subtitle: "Connect Dropbox to back up and sync your data across devices.",
        type: "_dropbox",
        style: "ascii",
        optional: true,
      });
    }

    if (needsGemini) {
      list.push({
        key: "_gemini",
        title: "GEMINI API KEY",
        subtitle: "Required for AI features. Get yours free at aistudio.google.com/apikey",
        type: "_gemini",
        style: "geometric",
        optional: false,
      });
    }

    // Profile fields — always shown
    list.push(
      {
        key: "name",
        title: "SYSTEM INITIALIZATION",
        subtitle: "Hunter identification required.",
        field: "name", label: "YOUR NAME", placeholder: "Enter designation...", type: "text",
        style: "ascii",
        maxLen: 60,
      },
      {
        key: "major",
        title: "FIELD OF STUDY",
        subtitle: "Specialization determines mission parameters.",
        field: "major", label: "MAJOR / FIELD", placeholder: "e.g. Computer Science, Physics...", type: "text",
        style: "geometric",
        maxLen: 80,
      },
      {
        key: "books",
        title: "KNOWLEDGE BASE",
        subtitle: "Books and authors you read. This shapes your quotes and lore cards.",
        field: "books", label: "FAVORITE BOOKS / AUTHORS", placeholder: "e.g. Richard Feynman, Brandon Sanderson, Dune...", type: "textarea",
        style: "dots",
        maxLen: 200,
      },
      {
        key: "interests",
        title: "INTEREST MAPPING",
        subtitle: "Hobbies and subjects outside study. Used to personalize observations.",
        field: "interests", label: "INTERESTS", placeholder: "e.g. Chess, weightlifting, philosophy...", type: "textarea",
        style: "typewriter",
        maxLen: 200,
      },
      {
        key: "semesterGoal",
        title: "SEMESTER OBJECTIVE",
        subtitle: "State your primary goal for this semester.",
        field: "semesterGoal", label: "SEMESTER GOAL", placeholder: "e.g. Finish with >90 GPA, land internship...", type: "textarea",
        style: "geometric",
        maxLen: 300,
      },
    );

    return list;
  }, [needsDropbox, needsGemini]);

  const current = steps[step];

  // ── Helpers ──────────────────────────────────────────────────
  function sanitizeField(str, maxLen = 300) {
    return sanitizeForPrompt(str ?? "", maxLen);
  }

  function sanitizeForm(f) {
    return {
      name: sanitizeField(f.name, 60),
      major: sanitizeField(f.major, 80),
      books: sanitizeField(f.books, 200),
      interests: sanitizeField(f.interests, 200),
      semesterGoal: sanitizeField(f.semesterGoal, 300),
      utcOffsetMinutes: -(new Date().getTimezoneOffset()),
      timezoneLabel: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Unknown",
    };
  }

  function advance() {
    setError("");
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(sanitizeForm(form));
    }
  }

  function handleNext() {
    if (current.type === "_dropbox" || current.type === "_gemini") {
      advance();
      return;
    }
    if (!form[current.field]?.trim()) {
      setError("This field is required.");
      return;
    }
    advance();
  }

  const isLastStep = step === steps.length - 1;
  const styleMap = STYLE_CSS;
  const s = styleMap[current.style] || styleMap.ascii;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{
      height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", padding: "24px", background: "#0a0a0a",
    }}>
      {/* App icon */}
      <img
        src={APP_ICON_URL}
        alt=""
        style={{ width: 44, height: 44, marginTop: "16px", marginBottom: "12px" }}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
      {/* Progress bar */}
      <div style={{ width: "100%", maxWidth: "380px", marginBottom: "24px", marginTop: "16px" }}>
        <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: "2px", background: i <= step ? "#fff" : "#333" }} />
          ))}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "11px", color: "#666", textAlign: "right" }}>
          {step + 1}/{steps.length}
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: "380px", padding: "24px",
        background: s.background, border: s.border,
        fontFamily: s.fontFamily,
      }}>
        <GeometricCorners style={current.style} />
        <div style={{ fontSize: "11px", color: "#888", letterSpacing: "3px", marginBottom: "8px" }}>
          PROTOCOL {step + 1}
        </div>
        <div style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "6px", letterSpacing: "1px" }}>
          {current.title}
        </div>
        <div style={{ fontSize: "13px", color: "#999", marginBottom: "18px", fontStyle: current.style === "dots" ? "italic" : "normal" }}>
          {current.subtitle}
        </div>

        {/* ── Step-specific content ── */}
        {current.type === "_dropbox" && (
          <DropboxOnboardingStep
            connectDropbox={connectDropbox}
            onSkip={advance}
            onAdvance={advance}
          />
        )}

        {current.type === "_gemini" && (
          <GeminiKeySetupScreen
            onSave={(key) => {
              onGeminiKeySaved(key, null);
              advance();
            }}
          />
        )}

        {current.type !== "_dropbox" && current.type !== "_gemini" && (
          <>
            <label style={{ fontSize: "11px", color: "#aaa", letterSpacing: "2px", display: "block", marginBottom: "6px", marginTop: "0" }}>
              {current.label}
            </label>
            {current.type === "textarea" ? (
              <textarea
                value={form[current.field]}
                onChange={(e) => setForm((f) => ({ ...f, [current.field]: e.target.value }))}
                placeholder={current.placeholder}
                rows={3}
                maxLength={current.maxLen}
                style={inputStyle(s)}
              />
            ) : (
              <input
                type={current.type}
                value={form[current.field]}
                onChange={(e) => setForm((f) => ({ ...f, [current.field]: e.target.value }))}
                placeholder={current.placeholder}
                maxLength={current.maxLen}
                style={inputStyle(s)}
              />
            )}

            {error && <div style={{ color: "#ccc", fontSize: "12px", marginTop: "8px" }}>⚠ {error}</div>}

            <div style={{ fontSize: "11px", color: "#555", fontFamily: "'Share Tech Mono', monospace", marginTop: "8px" }}>
              DETECTED TIMEZONE: {Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Unknown"}
              {" "}(UTC{-(new Date().getTimezoneOffset()) >= 0 ? "+" : ""}{(-(new Date().getTimezoneOffset()) / 60).toFixed(0)})
            </div>

            <button type="button" onClick={handleNext} style={{ ...primaryBtn, marginTop: "16px" }}>
              {isLastStep ? "INITIALIZE RITMOL" : "NEXT ›"}
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: "16px", marginBottom: "32px", fontSize: "10px", color: "#444", fontFamily: "'Share Tech Mono', monospace" }}>
        RITMOL v1.0 // LOCAL STORAGE ONLY // ZERO TELEMETRY
      </div>
    </div>
  );
}
