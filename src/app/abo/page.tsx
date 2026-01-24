"use client";

import React, { useEffect, useState } from "react";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3002"
).replace(/\/+$/, "");

const ENDPOINTS = {
  billingPortal: `${API_BASE_URL}/api/create-portal-session`,
};

const USER_ID_KEY = "gle_user_id_v1";
const ACCOUNT_ID_KEY = "gle_account_id_v1";
const APIKEY_STORAGE_KEY = "gle_api_key_v1";

function safeGet(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function headersWithIds(uid: string, acc: string, apiKey?: string) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "x-gle-user": uid,
    "x-gle-account-id": acc,
  };
  if (apiKey?.trim()) h["x-gle-api-key"] = apiKey.trim(); // ✅ nur wenn gesetzt
  return h;
}

export default function AboPage() {
  const [msg, setMsg] = useState("Öffne Billing Portal…");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const uid = safeGet(USER_ID_KEY).trim();
      const acc = safeGet(ACCOUNT_ID_KEY).trim();
      const apiKey = safeGet(APIKEY_STORAGE_KEY).trim();

      if (!uid || !acc) {
        setError(
          "IDs fehlen (userId/accountId).\nBitte zurück zur Startseite und dort „Account wiederherstellen“ / „Sync“ nutzen."
        );
        setMsg("Kann Portal nicht öffnen.");
        return;
      }

      try {
        const res = await fetch(ENDPOINTS.billingPortal, {
          method: "POST",
          cache: "no-store",
          headers: headersWithIds(uid, acc, apiKey),
          body: JSON.stringify({ userId: uid, accountId: acc }),
        });

        const data = await res.json().catch(() => ({}));
        const url = String(data?.url || "");

        if (!res.ok || !url) {
          if (res.status === 404) {
            throw new Error(
              `404 Not Found – Endpoint stimmt nicht oder falsches API_BASE_URL.\nRequest: ${ENDPOINTS.billingPortal}`
            );
          }
          throw new Error(String(data?.error || `portal_${res.status}`));
        }

        window.location.href = url;
      } catch (e: any) {
        setError(`Portal error: ${String(e?.message || "unknown_error")}`);
        setMsg("Kann Portal nicht öffnen.");
      }
    })();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050608",
        color: "#e7e7ff",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(720px, 96vw)",
          border: "1px solid #202230",
          borderRadius: 18,
          background: "#0b0d14",
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>Abo verwalten</div>
        <div style={{ marginTop: 10, opacity: 0.85 }}>{msg}</div>

        {!!error && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: "1px solid #3b1d1d",
              background: "rgba(185,28,28,.12)",
              fontSize: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          <a
            href="/"
            style={{
              display: "inline-block",
              borderRadius: 14,
              border: "1px solid #202230",
              background: "#0f1118",
              color: "#e7e7ff",
              padding: "10px 12px",
              textDecoration: "none",
            }}
          >
            Zur Startseite
          </a>
        </div>
      </div>
    </main>
  );
}
