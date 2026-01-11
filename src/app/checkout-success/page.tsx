"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  "https://gle-prompt-studio-backend-1.onrender.com";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState("Aktiviere PRO…");

  useEffect(() => {
    const sessionId = sp.get("session_id");
    if (!sessionId) {
      setStatus("Fehler: session_id fehlt in der URL.");
      return;
    }

    (async () => {
      try {
        setStatus("Sync läuft…");

        const r = await fetch(`${API_BASE_URL}/api/sync-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const data = await r.json();

        if (!r.ok) {
          setStatus(`Fehler: ${data?.error || "sync_failed"}`);
          return;
        }

        const userId = data?.user_id || data?.userId;
        const accountId = data?.accountId;

        if (!userId || !accountId) {
          setStatus("Fehler: Sync ok, aber IDs fehlen (user_id/accountId).");
          return;
        }

        localStorage.setItem("gle_user_id_v1", String(userId));
        localStorage.setItem("gle_account_id_v1", String(accountId));

        setStatus("PRO aktiv ✅ Weiterleitung…");
        router.replace("/?paid=1");
      } catch {
        setStatus("Fehler: Netzwerkproblem (Backend nicht erreichbar).");
      }
    })();
  }, [sp, router]);

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>Danke! 🎉</h1>
      <p>{status}</p>

      <div style={{ marginTop: 16, opacity: 0.7, fontSize: 14 }}>
        <div>
          session_id: <code>{sp.get("session_id") || "-"}</code>
        </div>
      </div>
    </div>
  );
}
