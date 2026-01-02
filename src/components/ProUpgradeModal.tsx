"use client";

import React, { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:3002";

const CHECKOUT_URL = `${API_BASE_URL}/api/stripe/checkout`;
const USERID_STORAGE_KEY = "gle_user_id";

function getOrCreateUserId(): string {
  try {
    const existing = localStorage.getItem(USERID_STORAGE_KEY);
    if (existing && existing.trim()) return existing.trim();

    const newId =
      (globalThis.crypto?.randomUUID?.() ||
        `gle_${Math.random().toString(16).slice(2)}_${Date.now()}`) + "";

    localStorage.setItem(USERID_STORAGE_KEY, newId);
    return newId;
  } catch {
    return `gle_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

export default function ProUpgradeModal({ open }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const visible = useMemo(() => Boolean(open), [open]);

  useEffect(() => {
    if (visible) setErr("");
  }, [visible]);

  function close() {
    window.dispatchEvent(new Event("gle:close-pro-modal"));
  }

  async function goCheckout() {
    if (loading) return;

    setErr("");
    setLoading(true);

    try {
      const uid = getOrCreateUserId();
      if (!uid || !uid.trim()) {
        setErr(
          "User-ID konnte nicht erzeugt werden. Bitte Browser-Storage erlauben."
        );
        return;
      }

      const res = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gle-user": uid,
        },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErr(data?.error || `Checkout fehlgeschlagen (${res.status})`);
        return;
      }

      const url = data?.url;
      if (!url || typeof url !== "string") {
        setErr("Keine Checkout-URL erhalten.");
        return;
      }

      window.location.href = url;
    } catch (e: any) {
      setErr(e?.message || "Checkout nicht erreichbar (Backend down?)");
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        style={{
          width: "min(520px, 95vw)",
          borderRadius: 16,
          border: "1px solid #333647",
          background: "#121218",
          padding: 18,
          boxShadow: "0 18px 45px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <div
              style={{
                color: "#00e676",
                fontWeight: 900,
                letterSpacing: "0.04em",
              }}
            >
              GLE PRO
            </div>

            <div
              style={{
                color: "#cfd2dc",
                marginTop: 6,
                fontSize: 14,
                lineHeight: 1.35,
              }}
            >
              PRO: Server-Key inklusive (kein eigener OpenAI-Key nötig). Höhere
              Limits. Boost optional.
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            aria-label="Schließen"
            style={{
              border: "1px solid #333647",
              background: "#050608",
              color: "#cfd2dc",
              borderRadius: 999,
              padding: "6px 10px",
              cursor: "pointer",
              height: 34,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #202230",
            background: "#050608",
            color: "#cfd2dc",
            fontSize: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <span>✅ Server-Key inklusive (kein eigener OpenAI-Key nötig)</span>
            <span>✅ Mehr Prompts pro Monat</span>
          </div>

          <div style={{ marginTop: 8 }}>
            ✅ Quality Boost (GPT-5) – optional
          </div>

          <div style={{ marginTop: 8, opacity: 0.85 }}>
            Nach der Zahlung kommst du automatisch zurück – PRO wird aktiviert.
          </div>
        </div>

        {err && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: "1px solid #ff4b61",
              background: "#3b0b10",
              color: "#ffd2d5",
              fontSize: 14,
            }}
          >
            {err}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 14,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={close}
            disabled={loading}
            style={{
              border: "1px solid #333647",
              background: "transparent",
              color: "#9ca0b4",
              borderRadius: 12,
              padding: "10px 12px",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            Später
          </button>

          <button
            type="button"
            onClick={goCheckout}
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "10px 14px",
              fontWeight: 900,
              cursor: loading ? "default" : "pointer",
              background:
                "linear-gradient(135deg, #00e676, #00e676 40%, #ff7043)",
              color: "#050608",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Öffne Checkout…" : "Jetzt PRO holen"}
          </button>
        </div>
      </div>
    </div>
  );
}
