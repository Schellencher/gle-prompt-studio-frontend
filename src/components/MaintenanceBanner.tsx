"use client";

import React, { useEffect, useState } from "react";

export default function MaintenanceBanner({ enabled }: { enabled: boolean }) {
  const [bypass, setBypass] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // "closed" merken (damit OK wirklich verschwindet)
    try {
      setClosed(
        window.localStorage.getItem("gle_maintenance_banner_closed") === "1"
      );
    } catch {}

    // Bypass erkennen (einfach halten)
    let isBypass = false;

    try {
      // dein bisheriger Weg
      isBypass = window.localStorage.getItem("gle_bypass_active") === "1";
    } catch {}

    // optional: falls du den UI-Cookie schon nutzt/gesetzt hast
    // (schadet nicht – macht's nur stabiler)
    if (!isBypass && typeof document !== "undefined") {
      isBypass = document.cookie.includes("gle_bypass_ui=1");
    }

    setBypass(isBypass);
  }, [enabled]);

  if (!enabled || !bypass || closed) return null;

  function onOk() {
    try {
      window.localStorage.setItem("gle_maintenance_banner_closed", "1");
    } catch {}
    setClosed(true);
  }

  function onClearBypass() {
    // LocalStorage-Flags weg (UI)
    try {
      window.localStorage.removeItem("gle_bypass_active");
      window.localStorage.removeItem("gle_maintenance_banner_closed");
    } catch {}

    // Cookies löscht die Middleware per resetBypass=1
    window.location.href = "/maintenance?resetBypass=1";
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-lg">
        <div className="text-sm text-zinc-900">
          <span className="font-semibold">WARTUNG AKTIV</span>{" "}
          <span className="text-zinc-600">(öffentlich gesperrt)</span>{" "}
          <span className="font-semibold">— BYPASS:</span>{" "}
          <span className="text-zinc-600">du kannst testen</span>
        </div>

        <button
          onClick={onClearBypass}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          title="Bypass deaktivieren (ohne Site-Data löschen)"
        >
          Bypass löschen
        </button>

        <button
          onClick={onOk}
          className="rounded-xl bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          ok
        </button>
      </div>
    </div>
  );
}
