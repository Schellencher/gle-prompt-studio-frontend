// frontend/src/app/billing-return/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type UiLang = "de" | "en";

const UI_LANG_KEY = "gle_ui_lang_v1";

function getLang(): UiLang {
  try {
    const v = (localStorage.getItem(UI_LANG_KEY) || "").toLowerCase().trim();
    if (v === "en" || v === "de") return v;
  } catch {}
  return "de";
}

export default function BillingReturnPage() {
  const [ui, setUi] = useState<UiLang>("de");
  const [seconds, setSeconds] = useState<number>(3);

  useEffect(() => {
    setUi(getLang());
  }, []);

  const t = useMemo(() => {
    const de = {
      title: "Zurück zur App…",
      sub: (s: number) => `Du wirst automatisch weitergeleitet (${s}s)`,
      back: "← Zurück zu GLE Prompt Studio",
      refresh: "Status aktualisieren",
      hint: "Tipp: Wenn du gerade gekündigt/aktualisiert hast, kann es 1–2 Sekunden dauern, bis Stripe den Status per Webhook aktualisiert.",
    };
    const en = {
      title: "Back to the app…",
      sub: (s: number) => `Redirecting automatically (${s}s)`,
      back: "← Back to GLE Prompt Studio",
      refresh: "Refresh status",
      hint: "Tip: After canceling/updating, it can take 1–2 seconds for Stripe webhooks to update your status.",
    };
    return ui === "en" ? en : de;
  }, [ui]);

  useEffect(() => {
    const i = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    const to = setTimeout(() => {
      // trigger your Home auto-refresh logic via ?from=billing
      window.location.href = "/?from=billing";
    }, 3000);

    return () => {
      clearInterval(i);
      clearTimeout(to);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050608",
        color: "#e8e8ee",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 16,
          border: "1px solid #202230",
          background: "rgba(10,12,18,0.6)",
          padding: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 22 }}>✅</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{t.title}</div>
            <div style={{ opacity: 0.8, marginTop: 2, fontSize: 13 }}>
              {t.sub(seconds)}
            </div>
          </div>
        </div>

        <div
          style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2d3f",
              background: "#0b0e16",
              color: "#e8e8ee",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            {t.back}
          </a>

          <a
            href="/?from=billing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #2a2d3f",
              background: "#0b0e16",
              color: "#e8e8ee",
              textDecoration: "none",
              fontWeight: 800,
              opacity: 0.9,
            }}
          >
            {t.refresh}
          </a>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.72 }}>
          {t.hint}
        </div>
      </div>
    </div>
  );
}
