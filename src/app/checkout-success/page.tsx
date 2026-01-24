"use client";

import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:3002";

export default function CheckoutSuccessPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">(
    "idle"
  );
  const [msg, setMsg] = useState<string>("");

  // 1) session_id aus URL holen (nur im Browser)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setSessionId(sp.get("session_id"));
  }, []);

  // 2) Sync call (nur wenn session_id da ist)
  useEffect(() => {
    if (!sessionId) return;

    (async () => {
      try {
        setStatus("syncing");
        setMsg("Aktiviere PRO…");

        const res = await fetch(`${API_BASE_URL}/api/sync-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || `sync_failed_${res.status}`);
        }

        setStatus("done");
        setMsg("✅ PRO aktiviert! Du kannst zurück zur App.");
      } catch (e: any) {
        setStatus("error");
        setMsg(`❌ Sync fehlgeschlagen: ${e?.message || "unknown_error"}`);
      }
    })();
  }, [sessionId]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Checkout erfolgreich</h1>
      <p style={{ opacity: 0.85 }}>{msg || "Lade…"}</p>

      {status === "done" && (
        <a href="/" style={{ display: "inline-block", marginTop: 16 }}>
          Zurück zur App →
        </a>
      )}

      {status === "error" && (
        <p style={{ marginTop: 12, opacity: 0.85 }}>
          Tipp: Prüfe, ob die URL wirklich `?session_id=...` enthält.
        </p>
      )}
    </main>
  );
}
