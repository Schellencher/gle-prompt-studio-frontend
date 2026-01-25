"use client";

import { useEffect, useState } from "react";

export default function EnvStatusPill({
  maintenanceEnabled,
}: {
  maintenanceEnabled: boolean;
}) {
  const [bypass, setBypass] = useState(false);

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search).get("bypass");
    const qpActive = !!(qp && qp.trim().length > 0);

    if (qpActive) localStorage.setItem("gle_bypass_active", "1");
    const lsActive = localStorage.getItem("gle_bypass_active") === "1";

    setBypass(qpActive || lsActive);
  }, []);

  // Immer sichtbar (weil genau dafür ist es da)
  const label = maintenanceEnabled ? "MAINTENANCE" : "LIVE";
  const sub = bypass ? "BYPASS" : "PUBLIC";

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        right: 10,
        zIndex: 999999,
        padding: "6px 10px",
        borderRadius: 999,
        background: maintenanceEnabled
          ? "rgba(255,140,0,.18)"
          : "rgba(0,230,118,.16)",
        border: maintenanceEnabled
          ? "1px solid rgba(255,140,0,.35)"
          : "1px solid rgba(0,230,118,.28)",
        color: "#e9f6ff",
        fontSize: 12,
        fontWeight: 900,
        display: "flex",
        gap: 8,
        alignItems: "center",
        backdropFilter: "blur(8px)",
      }}
    >
      <span>{label}</span>
      <span style={{ opacity: 0.8, fontWeight: 800 }}>·</span>
      <span style={{ fontWeight: 800 }}>{sub}</span>
    </div>
  );
}
