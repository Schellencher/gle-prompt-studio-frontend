"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * GLE Prompt Studio — src/app/page.tsx (CLEAN, COMPLETE)
 * Features:
 * - Real dropdowns for Use Case + Tone (with optional custom inputs)
 * - BYOK key (show/hide + test) stored locally
 * - AccountId/UserId stored locally (restore supported)
 * - /api/health + /api/me status (plan, renewAt, cancelAt, usage/limits)
 * - Generate (BYOK or PRO server) + Boost toggle
 * - History + Copy + Clear
 * - PRO modal with Checkout + Sync
 * - Billing portal (Manage subscription)
 * - MAINTENANCE billing lock via NEXT_PUBLIC_MAINTENANCE_MODE (UI disables billing)
 *
 * ENV (Vercel):
 * - NEXT_PUBLIC_BACKEND_URL=https://gle-prompt-studio-backend-1.onrender.com
 * - NEXT_PUBLIC_MAINTENANCE_MODE=0|1   (only locks billing buttons in UI)
 */

const BACKEND =
  (process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/$/, "") ||
  "https://gle-prompt-studio-backend-1.onrender.com";

const MAINTENANCE_BILLING_OFF =
  String(process.env.NEXT_PUBLIC_MAINTENANCE_MODE || "0").trim() === "1";

const LS = {
  userId: "gle_user_id_v1",
  accountId: "gle_account_id_v1",
  byok: "gle_openai_byok_key_v1",
  history: "gle_history_v1",
  bypass: "gle_bypass_active",
};

type Plan = "FREE" | "PRO";

type ApiMe = {
  ok: boolean;
  plan: Plan;
  renewAt: number;
  cancelAt: number;
  stripe?: {
    mode?: string;
    customerId?: string;
    subscriptionId?: string;
    hasCustomerId?: boolean;
    status?: string;
    cancelAtPeriodEnd?: boolean;
  };
  usage?: {
    used: number;
    lastTs: number;
    monthKey: string;
    boostUsed: number;
  };
  limits?: { FREE_LIMIT: number; PRO_LIMIT: number; PRO_BOOST_LIMIT: number };
};

type GenResp =
  | {
      ok: true;
      output: string;
      plan: Plan;
      mode: string;
      usage: {
        used: number;
        lastTs: number;
        monthKey: string;
        boostUsed: number;
      };
      limits: {
        FREE_LIMIT: number;
        PRO_LIMIT: number;
        PRO_BOOST_LIMIT: number;
      };
      renewAt: number;
      cancelAt: number;
    }
  | {
      ok: false;
      error: string;
      message?: string;
      used?: number;
      limit?: number;
      renewAt?: number;
      boostUsed?: number;
      boostLimit?: number;
      trial?: any;
    };

type HistoryItem = {
  ts: number;
  useCase: string;
  tone: string;
  topic: string;
  outLang: "de" | "en";
  boost: boolean;
  output: string;
};

function now() {
  return Date.now();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDate(ts: number, lang: "de" | "en" = "de") {
  if (!ts || ts <= 0) return "-";
  const d = new Date(ts);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  if (lang === "en") return `${yyyy}-${mm}-${dd}`;
  return `${dd}.${mm}.${yyyy}`;
}

function randomId(prefix: string) {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  const hex = Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${hex}`;
}

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function clampStr(s: string, max = 6000) {
  const t = String(s || "");
  return t.length > max ? t.slice(0, max) : t;
}

function getQueryParam(name: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) || "";
}

function replaceUrlWithoutParams() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());
}

function blockBillingIfMaintenance() {
  if (!MAINTENANCE_BILLING_OFF) return false;
  alert("Wartung aktiv – Abo/Checkout ist aktuell deaktiviert.");
  return true;
}

/* -------------------------
   UI building blocks
-------------------------- */
function Card(props: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #202230",
        background: "#0b0d14",
        borderRadius: 18,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 900, color: "#e7e7ff" }}>{props.title}</div>
        <div>{props.right}</div>
      </div>
      <div>{props.children}</div>
    </div>
  );
}

function Btn(props: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "primary" | "ghost";
  title?: string;
}) {
  const { disabled, kind = "ghost" } = props;
  const bg =
    kind === "primary"
      ? disabled
        ? "rgba(0,230,118,.16)"
        : "rgba(0,230,118,.24)"
      : "rgba(15,17,24,.9)";
  const br =
    kind === "primary" ? "1px solid rgba(0,230,118,.35)" : "1px solid #202230";
  return (
    <button
      type="button"
      title={props.title}
      disabled={disabled}
      onClick={props.onClick}
      style={{
        borderRadius: 12,
        border: br,
        background: bg,
        color: "#e7e7ff",
        padding: "8px 12px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        fontWeight: 800,
        fontSize: 13,
      }}
    >
      {props.children}
    </button>
  );
}

function Input(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      value={props.value}
      type={props.type || "text"}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      style={{
        width: "100%",
        borderRadius: 12,
        border: "1px solid #202230",
        background: "#0f1118",
        color: "#e7e7ff",
        padding: "10px 12px",
        outline: "none",
      }}
    />
  );
}

function TextArea(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={props.value}
      rows={props.rows || 4}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      style={{
        width: "100%",
        borderRadius: 12,
        border: "1px solid #202230",
        background: "#0f1118",
        color: "#e7e7ff",
        padding: "10px 12px",
        outline: "none",
        resize: "vertical",
      }}
    />
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Row(props: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
      }}
    >
      {props.children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#202230", margin: "14px 0" }} />;
}

/* -------------------------
   PRO Modal
-------------------------- */
function Modal(props: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.65)",
        display: "grid",
        placeItems: "center",
        padding: 14,
        zIndex: 9999,
      }}
      onMouseDown={props.onClose}
    >
      <div
        style={{
          width: "min(760px, 96vw)",
          borderRadius: 18,
          border: "1px solid #202230",
          background: "#0b0d14",
          color: "#e7e7ff",
          padding: 14,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 900 }}>{props.title}</div>
          <Btn onClick={props.onClose} title={props.closeLabel}>
            {props.closeLabel}
          </Btn>
        </div>
        <div style={{ marginTop: 12 }}>{props.children}</div>
      </div>
    </div>
  );
}

/* -------------------------
   Page
-------------------------- */
export default function Page() {
  // IDs
  const [userId, setUserId] = useState("anon");
  const [accountId, setAccountId] = useState("");

  // BYOK key
  const [byokKey, setByokKey] = useState("");
  const [byokVisible, setByokVisible] = useState(false);

  // Backend status
  const [health, setHealth] = useState<any>(null);
  const [me, setMe] = useState<ApiMe | null>(null);

  // Form
  const useCases = useMemo(
    () => [
      "Social Media Post",
      "Produktbeschreibung",
      "Landingpage",
      "E-Mail Marketing",
      "Blog Artikel",
      "YouTube Script",
      "Ad Copy (Meta/Google)",
      "LinkedIn Post",
      "Funnel / Offer",
      "Sonstiges (Custom)",
    ],
    []
  );
  const tones = useMemo(
    () => [
      "Neutral",
      "Freundlich",
      "Professionell",
      "Direkt",
      "Salesy",
      "Luxus",
      "Humorvoll",
      "Storytelling",
      "Autoritativ",
      "Sonstiges (Custom)",
    ],
    []
  );

  const [useCaseSel, setUseCaseSel] = useState(useCases[0]);
  const [toneSel, setToneSel] = useState(tones[0]);
  const [useCaseCustom, setUseCaseCustom] = useState("");
  const [toneCustom, setToneCustom] = useState("");

  const [topic, setTopic] = useState("");
  const [extra, setExtra] = useState("");
  const [outLang, setOutLang] = useState<"de" | "en">("de");
  const [boost, setBoost] = useState(false);

  // Output
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // PRO modal
  const [showPro, setShowPro] = useState(false);

  const plan: Plan = (me?.plan || "FREE") as Plan;

  const effectiveUseCase =
    useCaseSel === "Sonstiges (Custom)" ? useCaseCustom.trim() : useCaseSel;
  const effectiveTone =
    toneSel === "Sonstiges (Custom)" ? toneCustom.trim() : toneSel;

  const headersBase = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (userId) h["x-gle-user"] = userId;
    if (accountId) h["x-gle-account-id"] = accountId;
    if (byokKey.trim()) h["x-gle-api-key"] = byokKey.trim();
    return h;
  }, [userId, accountId, byokKey]);

  // init
  useEffect(() => {
    // ids
    const uid = localStorage.getItem(LS.userId) || "anon";
    const aid = localStorage.getItem(LS.accountId) || "";
    const key = localStorage.getItem(LS.byok) || "";
    setUserId(uid);
    setAccountId(aid);
    setByokKey(key);

    // history
    const hRaw = localStorage.getItem(LS.history) || "[]";
    const items = safeJsonParse<HistoryItem[]>(hRaw, []);
    setHistory(Array.isArray(items) ? items : []);

    // bypass remember
    const qp = getQueryParam("bypass");
    if (qp && qp.trim().length > 0) localStorage.setItem(LS.bypass, "1");

    // auto sync from checkout success (if your success route returns to "/?session_id=...")
    const sid = getQueryParam("session_id");
    if (sid) {
      // we'll sync below after IDs are loaded; defer
      setTimeout(() => {
        syncCheckoutSession(sid).finally(() => replaceUrlWithoutParams());
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ensure accountId exists
  useEffect(() => {
    if (!accountId) {
      const aid = randomId("acc");
      localStorage.setItem(LS.accountId, aid);
      setAccountId(aid);
    }
    if (!userId || userId === "anon") {
      const uid = "usr_" + randomId("u").slice(0, 14);
      localStorage.setItem(LS.userId, uid);
      setUserId(uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, userId]);

  // load status
  useEffect(() => {
    if (!accountId) return;
    refreshAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function refreshAll() {
    setErr("");
    await Promise.all([fetchHealth(), fetchMe()]);
  }

  async function fetchHealth() {
    try {
      const r = await fetch(`${BACKEND}/api/health`, { method: "GET" });
      const j = await r.json().catch(() => ({}));
      setHealth({ _status: r.status, ...j });
    } catch (e: any) {
      setHealth({ _status: 0, error: String(e?.message || e) });
    }
  }

  async function fetchMe() {
    try {
      const r = await fetch(`${BACKEND}/api/me`, {
        method: "GET",
        headers: headersBase,
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.ok) setMe(j as ApiMe);
      else setMe(null);
    } catch {
      setMe(null);
    }
  }

  async function testByokKey() {
    setErr("");
    const key = byokKey.trim();
    if (!key) {
      alert("Kein API-Key gesetzt.");
      return;
    }
    try {
      const r = await fetch(`${BACKEND}/api/test`, {
        method: "POST",
        headers: headersBase,
        body: JSON.stringify({ accountId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        alert(`Key Test fehlgeschlagen: ${j?.error || "unknown"}`);
        return;
      }
      alert(`Key OK ✅ (sample: "${String(j.sample || "").slice(0, 40)}")`);
    } catch (e: any) {
      alert(`Key Test Error: ${String(e?.message || e)}`);
    }
  }

  async function generate() {
    setErr("");
    setOutput("");
    const uc = effectiveUseCase.trim();
    const tn = effectiveTone.trim();
    if (!uc) return setErr("Bitte Anwendungsfall wählen oder Custom füllen.");
    if (!tn) return setErr("Bitte Ton wählen oder Custom füllen.");
    if (!topic.trim()) return setErr("Bitte Thema/Kontext ausfüllen.");

    setLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/generate`, {
        method: "POST",
        headers: headersBase,
        body: JSON.stringify({
          accountId,
          useCase: uc,
          tone: tn,
          topic: topic.trim(),
          extra: extra.trim(),
          outLang,
          boost,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as GenResp;

      if (!r.ok || !j || (j as any).ok === false) {
        const e = j as any;
        const msg = e?.message || e?.error || `request_failed_${r.status}`;
        // quota -> show info, offer PRO
        if (
          e?.error === "quota_reached" ||
          e?.error === "boost_quota_reached"
        ) {
          const renewAt = e?.renewAt
            ? formatDate(Number(e.renewAt), outLang)
            : "-";
          setErr(`Limit erreicht. Reset am ${renewAt}.`);
          if (plan === "FREE") setShowPro(true);
          return;
        }
        // missing key -> show PRO modal
        if (e?.error === "missing_api_key") {
          setErr("Kein API-Key gesetzt. Setze BYOK oder hol PRO.");
          setShowPro(true);
          return;
        }
        setErr(String(msg));
        return;
      }

      const ok = j as any;
      const out = String(ok.output || "").trim();
      setOutput(out);

      // refresh me (plan/usage)
      setMe((prev) =>
        prev
          ? {
              ...prev,
              plan: ok.plan,
              renewAt: ok.renewAt,
              cancelAt: ok.cancelAt,
              usage: ok.usage,
              limits: ok.limits,
            }
          : prev
      );

      // history
      const item: HistoryItem = {
        ts: now(),
        useCase: uc,
        tone: tn,
        topic: topic.trim(),
        outLang,
        boost,
        output: out,
      };
      const next = [item, ...history].slice(0, 50);
      setHistory(next);
      localStorage.setItem(LS.history, JSON.stringify(next));
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function openCheckout() {
    if (blockBillingIfMaintenance()) return;
    setErr("");
    try {
      const r = await fetch(`${BACKEND}/api/create-checkout-session`, {
        method: "POST",
        headers: headersBase,
        body: JSON.stringify({ accountId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok || !j?.url) {
        alert(`Checkout Error: ${j?.error || j?.message || r.status}`);
        return;
      }
      window.location.href = String(j.url);
    } catch (e: any) {
      alert(`Checkout Error: ${String(e?.message || e)}`);
    }
  }

  async function syncCheckoutSession(sessionId: string) {
    if (blockBillingIfMaintenance()) return;
    if (!sessionId) return;
    try {
      const r = await fetch(`${BACKEND}/api/sync-checkout-session`, {
        method: "POST",
        headers: headersBase,
        body: JSON.stringify({ accountId, sessionId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) return;
      // refresh me
      await fetchMe();
    } catch {
      // ignore
    }
  }

  async function openBillingPortal() {
    if (blockBillingIfMaintenance()) return;
    setErr("");
    try {
      const r = await fetch(`${BACKEND}/api/create-portal-session`, {
        method: "POST",
        headers: headersBase,
        body: JSON.stringify({ accountId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok || !j?.url) {
        alert(`Portal Error: ${j?.error || j?.message || r.status}`);
        return;
      }
      window.location.href = String(j.url);
    } catch (e: any) {
      alert(`Portal Error: ${String(e?.message || e)}`);
    }
  }

  function copyOutput() {
    const text = output || "";
    if (!text.trim()) return;
    navigator.clipboard
      .writeText(text)
      .then(() => alert("Kopiert ✅"))
      .catch(() => alert("Copy fehlgeschlagen"));
  }

  function clearHistory() {
    if (!confirm("History löschen?")) return;
    setHistory([]);
    localStorage.setItem(LS.history, "[]");
  }

  function saveByokKey(v: string) {
    const t = v;
    setByokKey(t);
    localStorage.setItem(LS.byok, t);
  }

  function restoreAccount(newAcc: string, newUser: string) {
    const a = newAcc.trim();
    const u = newUser.trim();
    if (!a) return alert("AccountId fehlt.");
    localStorage.setItem(LS.accountId, a);
    setAccountId(a);
    if (u) {
      localStorage.setItem(LS.userId, u);
      setUserId(u);
    }
    alert("Account wiederhergestellt ✅ (Reload optional)");
  }

  // Restore UI
  const [restoreAcc, setRestoreAcc] = useState("");
  const [restoreUser, setRestoreUser] = useState("");

  const badge = useMemo(() => {
    const used = me?.usage?.used ?? 0;
    const boostUsed = me?.usage?.boostUsed ?? 0;
    const limFree = me?.limits?.FREE_LIMIT ?? health?.limits?.FREE_LIMIT ?? 0;
    const limPro = me?.limits?.PRO_LIMIT ?? health?.limits?.PRO_LIMIT ?? 0;
    const limBoost =
      me?.limits?.PRO_BOOST_LIMIT ?? health?.limits?.PRO_BOOST_LIMIT ?? 0;

    const limit = plan === "PRO" ? limPro : limFree;

    return {
      used,
      limit,
      boostUsed,
      boostLimit: limBoost,
      renewAt: me?.renewAt ?? 0,
      cancelAt: me?.cancelAt ?? 0,
    };
  }, [me, health, plan]);

  const proText =
    "PRO = Server-Key inklusive + höhere Limits + Boost.\n\n✅ Server-Key inklusive\n✅ Mehr Prompts / Monat\n✅ Quality Boost (optional)\n\nNach der Zahlung kommst du zurück – PRO wird aktiviert.";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050608",
        color: "#e7e7ff",
        padding: 14,
      }}
    >
      <div
        style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 12 }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "10px 2px",
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 20 }}>
              GLE Prompt Studio
            </div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              Backend: {BACKEND.replace("https://", "")}
              {MAINTENANCE_BILLING_OFF ? " · Billing-LOCK (UI)" : ""}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #202230",
                background: "#0b0d14",
              }}
            >
              Plan: <b>{plan}</b>
            </div>
            <Btn onClick={() => refreshAll()}>Refresh</Btn>
            <Btn
              kind="primary"
              disabled={MAINTENANCE_BILLING_OFF}
              onClick={() =>
                plan === "PRO" ? openBillingPortal() : openCheckout()
              }
              title={
                MAINTENANCE_BILLING_OFF ? "Billing deaktiviert" : undefined
              }
            >
              {plan === "PRO" ? "Abo verwalten" : "Checkout öffnen"}
            </Btn>
          </div>
        </div>

        {/* Status */}
        <Card
          title="Status"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <Btn
                onClick={() => setOutLang((p) => (p === "de" ? "en" : "de"))}
              >
                Lang: {outLang.toUpperCase()}
              </Btn>
            </div>
          }
        >
          <Row>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Account</div>
              <div style={{ fontFamily: "ui-monospace", fontSize: 12 }}>
                {accountId || "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>User</div>
              <div style={{ fontFamily: "ui-monospace", fontSize: 12 }}>
                {userId || "-"}
              </div>
            </div>
          </Row>

          <Divider />

          <Row>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Usage</div>
              <div style={{ fontWeight: 900 }}>
                {badge.used}/{badge.limit}
                {plan === "PRO" ? (
                  <span style={{ opacity: 0.8, fontWeight: 700 }}>
                    {" "}
                    · Boost {badge.boostUsed}/{badge.boostLimit}
                  </span>
                ) : null}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Reset am</div>
              <div style={{ fontWeight: 900 }}>
                {formatDate(badge.renewAt, outLang)}
              </div>
              {badge.cancelAt ? (
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  gekündigt zum {formatDate(badge.cancelAt, outLang)}
                </div>
              ) : null}
            </div>
          </Row>

          <Divider />

          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Health: <b>{health?._status ?? "-"}</b> · Me:{" "}
            <b>{me?.ok ? "200" : "-"}</b> · Stripe:{" "}
            <b>{health?.stripe ? "ON" : "OFF"}</b> ({health?.stripeMode || "-"})
          </div>
        </Card>

        {/* BYOK */}
        <Card
          title="OpenAI API-Key (BYOK)"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => setByokVisible((p) => !p)}>
                {byokVisible ? "Ausblenden" : "Anzeigen"}
              </Btn>
              <Btn onClick={() => testByokKey()} disabled={!byokKey.trim()}>
                Testen
              </Btn>
            </div>
          }
        >
          <Label>Key (lokal gespeichert)</Label>
          <Input
            type={byokVisible ? "text" : "password"}
            value={byokKey}
            onChange={saveByokKey}
            placeholder="sk-..."
          />
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Hinweis: Ohne BYOK kann FREE nicht generieren. PRO kann (wenn aktiv)
            über Server-Credits laufen.
          </div>
        </Card>

        {/* Generator */}
        <Card
          title="Generator"
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={boost}
                  onChange={(e) => setBoost(e.target.checked)}
                  disabled={plan !== "PRO"}
                />
                <span style={{ opacity: plan !== "PRO" ? 0.6 : 1 }}>
                  Quality Boost{" "}
                  <span style={{ opacity: 0.75 }}>(Mehr Tiefe)</span>
                </span>
              </label>
              <Btn kind="primary" onClick={() => generate()} disabled={loading}>
                {loading ? "Generiere…" : "Prompt generieren"}
              </Btn>
            </div>
          }
        >
          <Row>
            <div>
              <Label>Anwendungsfall</Label>
              <select
                value={useCaseSel}
                onChange={(e) => setUseCaseSel(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid #202230",
                  background: "#0f1118",
                  color: "#e7e7ff",
                  padding: "10px 12px",
                  outline: "none",
                }}
              >
                {useCases.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              {useCaseSel === "Sonstiges (Custom)" ? (
                <div style={{ marginTop: 8 }}>
                  <Input
                    value={useCaseCustom}
                    onChange={setUseCaseCustom}
                    placeholder="Eigener Anwendungsfall…"
                  />
                </div>
              ) : null}
            </div>

            <div>
              <Label>Ton</Label>
              <select
                value={toneSel}
                onChange={(e) => setToneSel(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid #202230",
                  background: "#0f1118",
                  color: "#e7e7ff",
                  padding: "10px 12px",
                  outline: "none",
                }}
              >
                {tones.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {toneSel === "Sonstiges (Custom)" ? (
                <div style={{ marginTop: 8 }}>
                  <Input
                    value={toneCustom}
                    onChange={setToneCustom}
                    placeholder="Eigener Ton…"
                  />
                </div>
              ) : null}
            </div>
          </Row>

          <div style={{ height: 12 }} />

          <Label>Thema / Kontext</Label>
          <TextArea
            value={topic}
            onChange={setTopic}
            rows={3}
            placeholder="Worum geht es genau?"
          />

          <div style={{ height: 12 }} />

          <Label>Extra Hinweise (z.B. „3 Varianten, Hook + CTA“)</Label>
          <TextArea
            value={extra}
            onChange={setExtra}
            rows={3}
            placeholder="Optional…"
          />

          <div style={{ height: 12 }} />

          <Row>
            <div>
              <Label>Output-Sprache</Label>
              <select
                value={outLang}
                onChange={(e) =>
                  setOutLang(e.target.value === "en" ? "en" : "de")
                }
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid #202230",
                  background: "#0f1118",
                  color: "#e7e7ff",
                  padding: "10px 12px",
                  outline: "none",
                }}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <Label>Billing</Label>
              <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
                {MAINTENANCE_BILLING_OFF ? (
                  <>
                    <b>Wartung (UI Lock)</b> – Checkout/Portal ist deaktiviert.
                  </>
                ) : (
                  <>
                    <b>Aktiv</b> – Checkout/Portal verfügbar.
                  </>
                )}
              </div>
            </div>
          </Row>

          {err ? (
            <div
              style={{
                marginTop: 12,
                color: "#ffb3b3",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {err}
            </div>
          ) : null}
        </Card>

        {/* Output */}
        <Card
          title="Output"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={copyOutput} disabled={!output.trim()}>
                Kopieren
              </Btn>
              <Btn onClick={() => setOutput("")} disabled={!output.trim()}>
                Leeren
              </Btn>
            </div>
          }
        >
          <TextArea
            value={output}
            onChange={setOutput}
            rows={10}
            placeholder="Hier erscheint der Master-Prompt…"
          />
        </Card>

        {/* History */}
        <Card
          title="History"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={clearHistory} disabled={history.length === 0}>
                History löschen
              </Btn>
            </div>
          }
        >
          {history.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Noch keine Einträge.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {history.slice(0, 12).map((h) => (
                <div
                  key={h.ts}
                  style={{
                    border: "1px solid #202230",
                    borderRadius: 14,
                    background: "#0f1118",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 13 }}>
                      {h.useCase} · {h.tone} · {h.outLang.toUpperCase()}
                      {h.boost ? " · BOOST" : ""}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {formatDate(h.ts, outLang)}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                    {h.topic}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <Btn onClick={() => setOutput(h.output)}>In Output</Btn>
                    <Btn
                      onClick={() =>
                        navigator.clipboard
                          .writeText(h.output)
                          .then(() => alert("Kopiert ✅"))
                          .catch(() => alert("Copy fehlgeschlagen"))
                      }
                    >
                      Copy
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Restore */}
        <Card title="Account wiederherstellen">
          <Row>
            <div>
              <Label>AccountId</Label>
              <Input
                value={restoreAcc}
                onChange={setRestoreAcc}
                placeholder="acc_..."
              />
            </div>
            <div>
              <Label>UserId (optional)</Label>
              <Input
                value={restoreUser}
                onChange={setRestoreUser}
                placeholder="usr_..."
              />
            </div>
          </Row>
          <div style={{ marginTop: 10 }}>
            <Btn onClick={() => restoreAccount(restoreAcc, restoreUser)}>
              Restore
            </Btn>
          </div>
        </Card>

        {/* Footer actions */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <Btn
            disabled={MAINTENANCE_BILLING_OFF}
            onClick={() => openCheckout()}
            title={MAINTENANCE_BILLING_OFF ? "Billing deaktiviert" : undefined}
          >
            Checkout öffnen
          </Btn>
          <Btn
            disabled={MAINTENANCE_BILLING_OFF}
            onClick={() => openBillingPortal()}
            title={MAINTENANCE_BILLING_OFF ? "Billing deaktiviert" : undefined}
          >
            Abo verwalten
          </Btn>
          <Btn
            onClick={() => {
              setShowPro(true);
            }}
          >
            PRO Info
          </Btn>
        </div>
      </div>

      {/* PRO Modal */}
      {showPro ? (
        <Modal title="GLE PRO" closeLabel="✕" onClose={() => setShowPro(false)}>
          <div
            style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, opacity: 0.92 }}
          >
            {proText}
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            <Btn onClick={() => setShowPro(false)}>Später</Btn>
            <Btn
              kind="primary"
              disabled={MAINTENANCE_BILLING_OFF}
              onClick={() => {
                if (blockBillingIfMaintenance()) return;
                openCheckout();
              }}
              title={
                MAINTENANCE_BILLING_OFF ? "Billing deaktiviert" : undefined
              }
            >
              Jetzt PRO holen
            </Btn>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
