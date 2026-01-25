"use client";

import { useEffect, useState } from "react";

export default function MaintenanceBanner({ enabled }: { enabled: boolean }) {
  const [bypass, setBypass] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    // 1) Query check
    const qp = new URLSearchParams(window.location.search).get("bypass");
    const qpActive = !!(qp && qp.trim().length > 0);

    // 2) Persist: localStorage (funktioniert immer, auch wenn Cookie HttpOnly ist)
    if (qpActive) localStorage.setItem("gle_bypass_active", "1");

    const lsActive = localStorage.getItem("gle_bypass_active") === "1";

    // 3) Optional: irgendein Cookie mit "bypass" im Namen (falls vorhanden)
    const cookieHasBypass = document.cookie
      .split("; ")
      .some((c) => c.split("=")[0]?.toLowerCase().includes("bypass"));

    setBypass(qpActive || lsActive || cookieHasBypass);
  }, []);

  // Nur zeigen wenn du im Bypass bist
  if (!bypass || closed) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 10,
        right: 10,
        zIndex: 999999,
        padding: "8px 12px",
        borderRadius: 12,
        background: enabled ? "rgba(255,140,0,.18)" : "rgba(0,180,255,.14)",
        border: enabled
          ? "1px solid rgba(255,140,0,.35)"
          : "1px solid rgba(0,180,255,.28)",
        color: "#e9f6ff",
        fontSize: 12,
        display: "flex",
        gap: 10,
        alignItems: "center",
        backdropFilter: "blur(8px)",
      }}
    >
      <strong>{enabled ? "MAINTENANCE ON" : "MAINTENANCE OFF"}</strong>
      <span>(Admin Bypass)</span>

      <button
        type="button"
        onClick={() => setClosed(true)}
        style={{
          marginLeft: 8,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,.18)",
          background: "rgba(0,0,0,.25)",
          color: "#e9f6ff",
          padding: "2px 8px",
          cursor: "pointer",
        }}
      >
        ok
      </button>
    </div>
  );
}
