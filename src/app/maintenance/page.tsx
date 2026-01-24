export default function Maintenance({
  searchParams,
}: {
  searchParams?: { bad?: string };
}) {
  const bad = searchParams?.bad === "1";
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          border: "1px solid #333",
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>🚧 Update / Wartung</h1>
        <p style={{ opacity: 0.8 }}>
          Die App ist gerade nicht öffentlich erreichbar.
        </p>

        <form
          action="/unlock"
          method="post"
          style={{ display: "grid", gap: 10, marginTop: 12 }}
        >
          <input
            name="token"
            placeholder="Admin Token…"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #444" }}
          />
          {bad && <div style={{ color: "#ff8080" }}>Token falsch.</div>}
          <button
            style={{
              padding: 10,
              borderRadius: 10,
              border: 0,
              background: "#00e676",
              color: "#000",
              fontWeight: 700,
            }}
          >
            🔓 Unlock
          </button>
        </form>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Tipp: Bookmark <code>/maintenance</code>
        </div>
      </div>
    </div>
  );
}
