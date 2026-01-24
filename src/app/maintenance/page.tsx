export default function Maintenance() {
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
          maxWidth: 520,
          width: "100%",
          border: "1px solid #333",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>🚧 Update / Wartung</h1>
        <p style={{ opacity: 0.8, marginTop: 10 }}>
          Die App ist gerade nicht öffentlich erreichbar. Bitte später erneut
          versuchen.
        </p>
      </div>
    </div>
  );
}
