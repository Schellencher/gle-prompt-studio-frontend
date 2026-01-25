"use client";

import { useEffect, useState } from "react";

export default function MaintenanceBanner({ enabled }: { enabled: boolean }) {
  const [bypass, setBypass] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    // Bypass aktiv wenn:
    // - URL hat ?bypass=...
    // - oder localStorage Flag ist gesetzt
    const qp = new URLSearchParams(window.location.search).get("bypass");
    const qpActive = !!(qp && qp.trim().length > 0);

    if (qpActive) localStorage.setItem("gle_bypass_active", "1");
    const lsActive = localStorage.getItem("gle_bypass_active") === "1";

    setBypass(qpActive || lsActive);
  }, []);

  // ✅ Banner nur zeigen wenn Wartung AN + Bypass aktiv
  if (!enabled || !bypass || closed) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 10,
        right: 10,
        zIndex: 999999,
        padding: "8px 12px",
        borderRadius: 12,
        background: "rgba(0,0,0,.65)",
        border: "1px solid rgba(255,140,0,.45)",
        color: "#e9f6ff",
        fontSize: 12,
        display: "flex",
        gap: 10,
        alignItems: "center",
        backdropFilter: "blur(8px)",
      }}
    >
      <strong>WARTUNG AKTIV</strong>
      <span>(öffentlich gesperrt)</span>
      <span>—</span>
      <span>
        <b>BYPASS</b>: du kannst testen
      </span>

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
