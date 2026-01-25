"use client";

import { useEffect, useState } from "react";

export default function MaintenanceBanner({ enabled }: { enabled: boolean }) {
  const [isBypass, setIsBypass] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const hasCookie = document.cookie
      .split("; ")
      .some((x) => x.startsWith("gle_bypass="));

    setIsBypass(hasCookie);
  }, [enabled]);

  if (!enabled || !isBypass || closed) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999999,
        padding: "8px 12px",
        borderRadius: 12,
        background: "rgba(255,140,0,.18)",
        border: "1px solid rgba(255,140,0,.35)",
        color: "#ffe6bf",
        fontSize: 12,
        display: "flex",
        gap: 10,
        alignItems: "center",
        backdropFilter: "blur(8px)",
      }}
    >
      <strong>MAINTENANCE ACTIVE</strong>
      <span>(Admin Bypass)</span>

      <button
        type="button"
        onClick={() => setClosed(true)}
        style={{
          marginLeft: 8,
          borderRadius: 10,
          border: "1px solid rgba(255,140,0,.35)",
          background: "rgba(0,0,0,.25)",
          color: "#ffe6bf",
          padding: "2px 8px",
          cursor: "pointer",
        }}
      >
        ok
      </button>
    </div>
  );
}
