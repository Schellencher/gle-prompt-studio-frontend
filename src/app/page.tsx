// src/app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  apiGet,
  apiPost,
  buildIdentityHeaders,
  mapGenerateBody,
} from "@/lib/gleCore";

/**
 * TYPES
 */
type Me = {
  plan: "PRO" | "FREE";
  renewAt: number;
  cancelAt: number;
  usage: { used: number; boostUsed: number; monthKey: string };
  limits: { FREE_LIMIT: number; PRO_LIMIT: number; PRO_BOOST_LIMIT: number };
  stripe: { mode: string; hasCustomerId: boolean; status: string };
};

type GenOk = {
  output: string;
  mode: string;
  model: string;
  plan: "PRO" | "FREE";
  used: number;
  limit: number;
  boostUsed: number;
  boostLimit: number;
  renewAt: number;
  cancelAt: number;
};

type AnyErr = {
  ok?: false;
  error?: string;
  message?: string;
  status?: number;
  hard?: string[];
  hard_violations?: string[];
  banned?: string[];
  [k: string]: any;
};

const LS_ACCOUNT = "gle_account_id";
const LS_USER = "gle_user_id";
const LS_APIKEY = "gle_api_key_v1";

/**
 * COMPONENT
 */
export default function Home() {
  // Identität (UI-override, wird auch in localStorage gespiegelt)
  const [accountId, setAccountId] = useState("");
  const [userId, setUserId] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Formular
  const [useCase, setUseCase] = useState("Landingpage / Ad-Copy");
  const [tone, setTone] = useState("Professionell");
  const [goal, setGoal] = useState(
    "GLE Prompt Studio – KI-Tool für Creator & Solopreneure: Social Posts, Ads & Landingpages in Sekunden (Early Access)",
  );
  const [context, setContext] =
    useState(`Schreibe eine typische SaaS-Hero-Sektion + Bulletpoints.
Format exakt so:

1) Headline (max. 9 Wörter)
2) Subheadline (1 Satz)
3) 5 Bulletpoints (kurz, knackig)
4) CTA-Zeile (1 Satz)
5) Mini-FAQ: 3 Fragen + Antworten (je 1 Satz)

Infos, die rein müssen:
- Early Access / Warteliste offen
- Preis später 19,99€/Monat
- Zielgruppe: Creator & Solopreneure
- weniger Zeitverlust, schneller Content, konsistente Qualität

Keine Emojis. Kein Meta-Gerede.`);
  const [language, setLanguage] = useState<"de" | "en">("de");
  const [boost, setBoost] = useState(false);

  // App-State
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [err, setErr] = useState<AnyErr | null>(null);

  // Init: IDs + apiKey aus localStorage
  useEffect(() => {
    try {
      const a = localStorage.getItem(LS_ACCOUNT);
      const u = localStorage.getItem(LS_USER);
      const k = localStorage.getItem(LS_APIKEY);

      // Falls noch nix da ist: initial befüllen
      if (!a) localStorage.setItem(LS_ACCOUNT, `acc_${safeUUID()}`);
      if (!u) localStorage.setItem(LS_USER, `u_${safeUUID()}`);

      setAccountId((a || localStorage.getItem(LS_ACCOUNT) || "").trim());
      setUserId((u || localStorage.getItem(LS_USER) || "").trim());
      setApiKey((k || "").trim());
    } catch {
      // ignore
    }
  }, []);

  // Spiegeln: UI → localStorage (damit Backend/Headers konstant bleiben)
  useEffect(() => {
    try {
      if (accountId) localStorage.setItem(LS_ACCOUNT, accountId);
      if (userId) localStorage.setItem(LS_USER, userId);
      localStorage.setItem(LS_APIKEY, apiKey || "");
    } catch {
      // ignore
    }
  }, [accountId, userId, apiKey]);

  // Headers (override account/user, weil buildIdentityHeaders standardmäßig localStorage liest)
  const headers = useMemo(() => {
    const extra: Record<string, string> = {};
    if (apiKey) extra["x-gle-api-key"] = apiKey;

    // Overrides (wichtig: nur setzen, wenn gefüllt)
    if (accountId) extra["x-gle-account-id"] = accountId;
    if (userId) extra["x-gle-user-id"] = userId;

    return buildIdentityHeaders(extra);
  }, [apiKey, accountId, userId]);

  async function refreshMe() {
    const res = await apiGet<Me>("/api/me", headers);
    if (res.ok) setMe(res);
    else setMe(null);
  }

  useEffect(() => {
    if (!accountId || !userId) return;
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  async function onGenerate() {
    setBusy(true);
    setErr(null);
    setOutput("");

    try {
      const body = mapGenerateBody({
        useCase,
        tone,
        goal,
        context,
        language,
        boost,
      });

      const res = await apiPost<GenOk>("/api/generate", body, headers);

      if (res.ok) {
        setOutput(res.output || "");
        await refreshMe();
      } else {
        setErr(res as AnyErr);
      }
    } catch (e: any) {
      setErr({
        ok: false,
        error: "client_error",
        message: e?.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onUpgrade() {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPost<{ url: string }>(
        "/api/create-checkout-session",
        { accountId, userId },
        headers,
      );
      if (res.ok) window.location.href = res.url;
      else setErr(res as AnyErr);
    } catch (e: any) {
      setErr({
        ok: false,
        error: "client_error",
        message: e?.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onBillingPortal() {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPost<{ url: string }>(
        "/api/billing-portal",
        { accountId, userId },
        headers,
      );
      if (res.ok) window.location.href = res.url;
      else setErr(res as AnyErr);
    } catch (e: any) {
      setErr({
        ok: false,
        error: "client_error",
        message: e?.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  function resetIds() {
    const newAcc = `acc_${safeUUID()}`;
    const newUser = `u_${safeUUID()}`;
    setAccountId(newAcc);
    setUserId(newUser);
  }

  const limit =
    me?.plan === "PRO" ? me?.limits?.PRO_LIMIT : me?.limits?.FREE_LIMIT;

  return (
    <main style={pageWrap}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
        GLE Prompt Studio — Generator
      </h1>

      {/* ID SECTION */}
      <div style={grid3}>
        <label>
          <div style={labelSmall}>Account ID</div>
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            style={inputStyle}
            placeholder="acc_..."
          />
        </label>

        <label>
          <div style={labelSmall}>User ID</div>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={inputStyle}
            placeholder="u_..."
          />
        </label>

        <label>
          <div style={labelSmall}>OpenAI API Key (BYOK optional)</div>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={inputStyle}
            placeholder="sk-..."
          />
        </label>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={pill}>
          Plan: <b>{me?.plan ?? "—"}</b> · Used: <b>{me?.usage?.used ?? "—"}</b>{" "}
          / <b>{limit ?? "—"}</b>
          {me?.plan === "PRO" ? (
            <>
              {" "}
              · Boost: <b>{me?.usage?.boostUsed ?? "—"}</b> /{" "}
              <b>{me?.limits?.PRO_BOOST_LIMIT ?? "—"}</b>
            </>
          ) : null}
        </div>

        <button onClick={refreshMe} disabled={busy} style={btnSecondary}>
          Refresh
        </button>

        <button onClick={resetIds} disabled={busy} style={btnSecondary}>
          Reset IDs
        </button>

        <button onClick={onUpgrade} disabled={busy} style={btnPrimary}>
          Upgrade PRO
        </button>

        <button onClick={onBillingPortal} disabled={busy} style={btnSecondary}>
          Billing Portal
        </button>
      </div>

      {/* CONFIG */}
      <div style={gridConfig}>
        <label>
          <div style={labelSmall}>Use-Case</div>
          <input
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label>
          <div style={labelSmall}>Ton</div>
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label>
          <div style={labelSmall}>Sprache</div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as any)}
            style={inputStyle}
          >
            <option value="de">DE</option>
            <option value="en">EN</option>
          </select>
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={boost}
            onChange={(e) => setBoost(e.target.checked)}
          />
          <span style={{ fontSize: 12 }}>Boost</span>
        </label>
      </div>

      <label>
        <div style={labelSmall}>Goal (UI) → topic (Backend)</div>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          style={textareaStyle}
        />
      </label>

      <div style={{ height: 10 }} />

      <label>
        <div style={labelSmall}>Context / Format (UI) → extra (Backend)</div>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={12}
          style={textareaStyle}
        />
      </label>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button onClick={onGenerate} disabled={busy} style={btnPrimary}>
          {busy ? "..." : "Generate"}
        </button>

        <button
          onClick={() => navigator.clipboard.writeText(output)}
          disabled={!output}
          style={btnSecondary}
        >
          Copy Output
        </button>
      </div>

      {err && (
        <div style={panelStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6, color: "#d00" }}>
            Error
          </div>

          {/* kleine Kurzinfo, damit man sofort sieht, warum */}
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>
            {err.error ? (
              <>
                <b>{err.error}</b>
                {err.message ? ` — ${err.message}` : ""}
              </>
            ) : (
              "Unbekannter Fehler"
            )}
            {Array.isArray(err.banned) && err.banned.length ? (
              <>
                {" "}
                · banned: <b>{err.banned.join(", ")}</b>
              </>
            ) : null}
            {Array.isArray(err.hard) && err.hard.length ? (
              <>
                {" "}
                · hard: <b>{err.hard.join(", ")}</b>
              </>
            ) : null}
          </div>

          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12 }}>
            {JSON.stringify(err, null, 2)}
          </pre>
        </div>
      )}

      {output && (
        <div style={panelStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Output</div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              margin: 0,
              fontSize: 14,
              lineHeight: 1.45,
            }}
          >
            {output}
          </pre>
        </div>
      )}
    </main>
  );
}

/**
 * HELPERS
 */
function safeUUID() {
  try {
    return crypto?.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

/**
 * STYLES
 */
const pageWrap: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 20,
  fontFamily: "system-ui, sans-serif",
};

const labelSmall: React.CSSProperties = { fontSize: 12, opacity: 0.8 };

const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 12,
  marginBottom: 12,
};

const gridConfig: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 120px 120px",
  gap: 12,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: "#fff",
  color: "#111",
  border: "1px solid #ddd",
};

const pill: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid #eee",
  fontSize: 12,
};

const panelStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  border: "1px solid #e2e2e2",
  borderRadius: 10,
};
