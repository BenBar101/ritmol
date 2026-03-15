// ═══════════════════════════════════════════════════════════════
// DECORATIVE HELPERS
// ═══════════════════════════════════════════════════════════════
export default function GeometricCorners({ style, small }) {
  if (style === "geometric") {
    const s = small ? 10 : 14;
    const cornerStyle = { position: "absolute", width: s, height: s, borderColor: "#fff" };
    return (
      <>
        <div style={{ ...cornerStyle, top: 4, left: 4, borderTop: "2px solid #fff", borderLeft: "2px solid #fff" }} />
        <div style={{ ...cornerStyle, top: 4, right: 4, borderTop: "2px solid #fff", borderRight: "2px solid #fff" }} />
        <div style={{ ...cornerStyle, bottom: 4, left: 4, borderBottom: "2px solid #fff", borderLeft: "2px solid #fff" }} />
        <div style={{ ...cornerStyle, bottom: 4, right: 4, borderBottom: "2px solid #fff", borderRight: "2px solid #fff" }} />
      </>
    );
  }
  if (style === "ascii") {
    return (
      <div style={{ position: "absolute", top: 4, left: 4, fontFamily: "'Share Tech Mono', monospace", fontSize: "16px", color: "#fff", fontWeight: "bold" }}>
        {small ? ">" : ">>"}
      </div>
    );
  }
  return null;
}
