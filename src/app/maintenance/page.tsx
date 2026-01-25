"use client";

import React, { useEffect, useMemo, useState } from "react";

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

export default function Maintenance() {
  const [token, setToken] = useState("");
  const [bypassSeen, setBypassSeen] = useState(false);
  const [msg, setMsg] = useState("");
  const [adminUIEnabled, setAdminUIEnabled] = useState(false);

  const resetUrl = useMemo(() => "/maintenance?resetBypass=1", []);
  const goStudioUrl = useMemo(() => "/", []);

  useEffect(() => {
    // Admin UI nur per HASH aktiv (damit es NIEMALS „aus Versehen“ aktiv ist)
    try {
      const hash = (window.location.hash || "").toLowerCase();
      setAdminUIEnabled(hash === "#admin");
    } catch {
      setAdminUIEnabled(false);
    }

    // Bypass-Indizien (nur fürs Badge)
    try {
      const ls = window.localStorage.getItem("gle_bypass_active") === "1";
      const ui = getCookie("gle_bypass_ui") === "1";
      setBypassSeen(ls || ui);
    } catch {
      setBypassSeen(false);
    }

    // Statusmeldung nach Reset + URL säubern (hash beibehalten)
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("resetBypass") === "1" || sp.get("bypass") === "0") {
        setMsg("Bypass wurde gelöscht.");
        sp.delete("resetBypass");
        sp.delete("bypass");
        const qs = sp.toString();
        const hash = window.location.hash || "";
        window.history.replaceState(
          {},
          "",
          qs ? `/maintenance?${qs}${hash}` : `/maintenance${hash}`
        );
      }
    } catch {}
  }, []);

  function startBypass() {
    const t = token.trim();
    if (!t) {
      setMsg("Bitte Token eingeben.");
      return;
    }
    setMsg("");
    try {
      window.localStorage.setItem("gle_bypass_active", "1"); // optional fürs UI
    } catch {}
    window.location.href = `/?bypass=${encodeURIComponent(t)}`;
  }

  function clearBypass() {
    try {
      window.localStorage.removeItem("gle_bypass_active");
      window.localStorage.removeItem("gle_maintenance_banner_closed");
    } catch {}
    window.location.href = resetUrl;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "#fafafa",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 14,
          right: 14,
          borderRadius: 999,
          border: "1px solid #e4e4e7",
          background: "white",
          padding: "8px 12px",
          fontSize: 12,
          color: "#111827",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        MAINTENANCE • PUBLIC
      </div>

      <div
        style={{
          maxWidth: 560,
          width: "100%",
          border: "1px solid #e4e4e7",
          borderRadius: 18,
          padding: 24,
          background: "white",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <h1 style={{ fontSize: 22, margin: 0, color: "#111827" }}>
              🚧 Wartung aktiv
            </h1>
            <p style={{ opacity: 0.85, marginTop: 10, color: "#4b5563" }}>
              Die App ist gerade nicht öffentlich erreichbar. Bitte später
              erneut versuchen.
            </p>
          </div>

          <div
            style={{
              height: 28,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 10px",
              borderRadius: 999,
              border: "1px solid",
              borderColor: bypassSeen ? "#a7f3d0" : "#fde68a",
              background: bypassSeen ? "#ecfdf5" : "#fffbeb",
              color: bypassSeen ? "#047857" : "#92400e",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {bypassSeen ? "Bypass aktiv" : "Öffentlich gesperrt"}
          </div>
        </div>

        {msg ? (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e4e4e7",
              background: "#f4f4f5",
              color: "#111827",
              fontSize: 13,
            }}
          >
            {msg}
          </div>
        ) : null}

        <div
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}
        >
          <button
            onClick={() => window.location.reload()}
            style={{
              borderRadius: 12,
              padding: "10px 14px",
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Neu laden
          </button>

          <a
            href={goStudioUrl}
            style={{
              borderRadius: 12,
              padding: "10px 14px",
              border: "1px solid #e4e4e7",
              background: "white",
              color: "#111827",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Status prüfen
          </a>

          <button
            onClick={clearBypass}
            title="Entfernt den Bypass (ohne Site-Data löschen)"
            style={{
              borderRadius: 12,
              padding: "10px 14px",
              border: "1px solid #e4e4e7",
              background: "white",
              color: "#111827",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Bypass löschen
          </button>
        </div>

        {/* ✅ Admin Panel: NUR sichtbar bei /maintenance#admin */}
        {adminUIEnabled ? (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 16,
              border: "1px solid #e4e4e7",
              background: "white",
            }}
          >
            <div style={{ fontWeight: 800, color: "#111827" }}>
              Admin Bypass
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#4b5563" }}>
              Token eingeben → du wirst ins Studio weitergeleitet.
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="bypass token…"
                style={{
                  flex: "1 1 240px",
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: "1px solid #e4e4e7",
                  outline: "none",
                }}
              />
              <button
                onClick={startBypass}
                style={{
                  borderRadius: 12,
                  padding: "10px 14px",
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "white",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Bypass aktivieren
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
              Bookmark für dich: <b>/maintenance#admin</b>
            </div>
          </div>
        ) : null}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          Support:{" "}
          <span style={{ color: "#374151", fontWeight: 700 }}>
            support@getlaunchedge.com
          </span>
        </div>
      </div>
    </div>
  );
}
