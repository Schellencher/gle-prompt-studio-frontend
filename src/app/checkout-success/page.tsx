"use client";

import React, { useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:3002";

export default function CheckoutSuccessPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("session_id") || "";
  }, []);

  const openPortal = async () => {
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/billing-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Portal failed");

      window.location.href = data.url; // Stripe Portal
    } catch (e: any) {
      setError(e?.message || "Fehler");
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>✅ Zahlung erfolgreich</h1>
      <p>Danke! Dein PRO-Status ist aktiv.</p>

      {!sessionId && (
        <p style={{ opacity: 0.8 }}>
          Hinweis: Keine session_id gefunden. Öffne diese Seite über den
          Stripe-Redirect.
        </p>
      )}

      <div
        style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}
      >
        <button
          onClick={openPortal}
          disabled={!sessionId || loading}
          style={{ padding: "10px 14px", cursor: "pointer" }}
        >
          {loading ? "Öffne Portal..." : "Abo verwalten (Rechnungen/Kündigung)"}
        </button>

        <a href="/" style={{ padding: "10px 14px" }}>
          Zurück zur App
        </a>
      </div>

      {error && <p style={{ marginTop: 12, color: "tomato" }}>{error}</p>}
    </div>
  );
}
