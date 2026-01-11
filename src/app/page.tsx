// frontend/src/app/page.tsx
"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

/* =========================
   Config
========================= */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:3002";

const ENDPOINTS = {
  generate: `${API_BASE_URL}/api/generate`,
  health: `${API_BASE_URL}/api/health`,
  testKey: `${API_BASE_URL}/api/test`,
  checkout: `${API_BASE_URL}/api/create-checkout-session`,
  billingPortal: `${API_BASE_URL}/api/create-portal-session`,
  me: `${API_BASE_URL}/api/me`,
  syncCheckout: `${API_BASE_URL}/api/sync-checkout-session`,
};

type BackendStatus = "unknown" | "ok" | "down";
type Plan = "FREE" | "PRO";
type UiLang = "de" | "en";

type Limits = { free: number; pro: number };

type Meta = {
  model?: string;
  tokens?: number;
  boost?: boolean;
  plan?: Plan;
  isBYOK?: boolean;
  requestId?: string;
  buildTag?: string;
  usingServerKey?: boolean;
};

type HistoryEntry = {
  id: string;
  timestamp: number;
  useCase: string;
  tone: string;
  outLang: UiLang;
  topic: string;
  extra: string;
  boost: boolean;
  result: string;
  meta?: Meta | null;
};

type StripeInfo = {
  customerId?: string;
  subscriptionId?: string;
  status?: string; // active | trialing | past_due | canceled | ...
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: number | null; // ms
  lastInvoiceStatus?: string; // paid | payment_failed
};

type MeResponseV2 = {
  ok?: boolean;
  user_id?: string;
  userId?: string;
  accountId?: string;
  plan?: Plan;
  usage?: { used?: number; renewAt?: number; tokens?: number; lastTs?: number };
  stripe?: StripeInfo;
  byokOnly?: boolean;
  limits?: Limits;
  buildTag?: string;
  ts?: number;
};

type MeResponseLegacy = {
  ok?: boolean;
  plan?: Plan;
  usage?: number;
  limit?: number;
  usageRenewDate?: string;
  accountId?: string;
  userId?: string;
  user_id?: string;
  byokOnly?: boolean;
  limits?: Limits;
  stripe?: StripeInfo | any;
  buildTag?: string;
};

type MeResponseAny = MeResponseV2 | MeResponseLegacy;

type HealthResponse = {
  status?: string;
  service?: string;
  buildTag?: string;
  stripe?: boolean;
  stripeMode?: string;
  stripePriceId?: string;
  byokOnly?: boolean;
  models?: { byok?: string; pro?: string; boost?: string };
  limits?: Limits;
  allowedOrigins?: string[];
  ts?: number;
};

/* =========================
   Storage Keys
========================= */

const USER_ID_KEY = "gle_user_id_v1";
const ACCOUNT_ID_KEY = "gle_account_id_v1";
const APIKEY_STORAGE_KEY = "gle_api_key_v1";
const PLAN_STORAGE_KEY = "gle_plan_v1";
const UI_LANG_KEY = "gle_ui_lang_v1";
const OUT_LANG_KEY = "gle_out_lang_v1";
const HISTORY_STORAGE_KEY = "gle_history_v1";
const LAST_SESSION_ID_KEY = "gle_last_checkout_session_id_v1";

const MAX_HISTORY = 10;
const DEFAULT_LIMITS: Limits = { free: 25, pro: 250 };
const SHOW_DEV = process.env.NODE_ENV !== "production";

// Mindestzeiten für UX (ms)
const MIN_GEN_PRO_MS = 1500;
const MIN_GEN_FREE_MS = 2500;

/* =========================
   i18n
========================= */

const TXT: Record<
  UiLang,
  {
    title: string;
    subtitle: string;
    checkoutOpen: string;
    manage: string;
    sync: string;
    restore: string;

    backend: string;
    byok: string;
    ui: string;
    output: string;

    apiKeyTitle: string;
    show: string;
    hide: string;
    test: string;
    keyHintByokOnly: string;
    keyHintNoKey: string;

    useCase: string;
    tone: string;
    topic: string;
    extra: string;
    boost: string;
    boostHint: string;

    generate: string;
    generating: string;

    outputTitle: string;
    historyTitle: string;

    copy: string;
    copied: string;
    clearHistory: string;

    planFree: string;
    planPro: string;
    resetOn: string;

    proModalTitle: string;
    proModalText: string;
    later: string;
    getPro: string;

    restoreTitle: string;
    restoreText: string;
    sessionIdLabel: string;
    restoreSync: string;
    restoreCheckout: string;

    missingIdsTitle: string;
    missingIdsText: string;
    ok: string;

    close: string;

    cancelScheduled: string;
    stripeLabel: string;
  }
> = {
  de: {
    title: "GLE Prompt Studio",
    subtitle:
      "Master-Prompts für Social Media, Blog, Produkttexte & Newsletter.",
    checkoutOpen: "Checkout öffnen",
    manage: "Abo verwalten",
    sync: "Sync",
    restore: "Account wiederherstellen",

    backend: "Backend",
    byok: "BYOK",
    ui: "UI",
    output: "Output",

    apiKeyTitle: "OpenAI API Key (BYOK)",
    show: "Show",
    hide: "Hide",
    test: "Test",
    keyHintByokOnly:
      "Hinweis: BYOK-Only aktiv. Ohne eigenen Key kann FREE nicht generieren.",
    keyHintNoKey:
      "Hinweis: Kein Key gesetzt. PRO kann trotzdem laufen (Server-Credits), wenn dein Account PRO ist.",

    useCase: "Use Case",
    tone: "Ton",
    topic: "Thema / Kontext",
    extra: "Extra Hinweise",
    boost: "Quality Boost",
    boostHint: "Mehr Tiefe & Qualität",

    generate: "Prompt generieren",
    generating: "Generiere…",

    outputTitle: "Output",
    historyTitle: "History",

    copy: "Kopieren",
    copied: "Kopiert",
    clearHistory: "History löschen",

    planFree: "FREE",
    planPro: "PRO",
    resetOn: "Reset am",

    proModalTitle: "GLE PRO",
    proModalText:
      "PRO = Server-Key inklusive + höhere Limits + Boost.\n\n✅ Server-Key inklusive\n✅ Mehr Prompts / Monat\n✅ Quality Boost (optional)\n\nNach der Zahlung kommst du zurück – PRO wird aktiviert.",
    later: "Später",
    getPro: "Jetzt PRO holen",

    restoreTitle: "Account wiederherstellen",
    restoreText:
      "Wenn du bereits bezahlt hast, kannst du deinen Account über die Stripe session_id wieder synchronisieren.\n\nTipp: Die session_id findest du in der Success-URL oder in Stripe (Checkout Session).",
    sessionIdLabel: "session_id",
    restoreSync: "Jetzt synchronisieren",
    restoreCheckout: "Checkout erneut öffnen",

    missingIdsTitle: "Account nicht gefunden",
    missingIdsText:
      "Für „Abo verwalten“ brauche ich deine gespeicherten IDs (accountId/userId). Wenn du auf einer neuen Domain bist, sind die ggf. leer. Nutze „Account wiederherstellen“ oder synchronisiere über session_id.",

    ok: "OK",
    close: "✕",

    cancelScheduled: "Kündigung vorgemerkt bis",
    stripeLabel: "Stripe",
  },
  en: {
    title: "GLE Prompt Studio",
    subtitle:
      "Master prompts for social media, blogs, product copy & newsletters.",
    checkoutOpen: "Open checkout",
    manage: "Manage subscription",
    sync: "Sync",
    restore: "Restore account",

    backend: "Backend",
    byok: "BYOK",
    ui: "UI",
    output: "Output",

    apiKeyTitle: "OpenAI API Key (BYOK)",
    show: "Show",
    hide: "Hide",
    test: "Test",
    keyHintByokOnly:
      "Note: BYOK-only is enabled. FREE cannot generate without your own key.",
    keyHintNoKey:
      "Note: No key set. PRO can still work (server credits) if your account is PRO.",

    useCase: "Use case",
    tone: "Tone",
    topic: "Topic / context",
    extra: "Extra notes",
    boost: "Quality Boost",
    boostHint: "More depth & quality",

    generate: "Generate prompt",
    generating: "Generating…",

    outputTitle: "Output",
    historyTitle: "History",

    copy: "Copy",
    copied: "Copied",
    clearHistory: "Clear history",

    planFree: "FREE",
    planPro: "PRO",
    resetOn: "Resets on",

    proModalTitle: "GLE PRO",
    proModalText:
      "PRO = server key included + higher limits + boost.\n\n✅ Server key included\n✅ More prompts / month\n✅ Quality Boost (optional)\n\nAfter payment you’ll return – PRO will be activated.",
    later: "Later",
    getPro: "Get PRO now",

    restoreTitle: "Restore account",
    restoreText:
      "If you already paid, you can restore your account using the Stripe session_id.\n\nTip: You can find session_id in the success URL or in Stripe (Checkout Session).",
    sessionIdLabel: "session_id",
    restoreSync: "Sync now",
    restoreCheckout: "Open checkout again",

    missingIdsTitle: "Account not found",
    missingIdsText:
      "To open the Billing Portal I need your saved IDs (accountId/userId). On a new domain those can be empty. Use “Restore account” or sync via session_id.",

    ok: "OK",
    close: "✕",

    cancelScheduled: "Cancel scheduled for",
    stripeLabel: "Stripe",
  },
};

/* =========================
   Helpers
========================= */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeId(): string {
  const uuid =
    typeof crypto !== "undefined" && (crypto as any)?.randomUUID
      ? (crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
          .toString(16)
          .slice(2)}`;
  return String(uuid)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 48);
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function pickOutput(data: any): string {
  return (
    data?.result ||
    data?.output ||
    data?.text ||
    data?.output_text ||
    data?.message ||
    ""
  )
    .toString()
    .trim();
}

function formatGermanDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function safePercent(used: number, limit: number): number {
  const u = Number.isFinite(used) ? used : 0;
  const l = Number.isFinite(limit) ? limit : 0;
  if (!l || l <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((u / l) * 100)));
}

// Creates IDs if missing (for app usage + checkout + generate)
function ensureIdsNow(currentUserId?: string, currentAccountId?: string) {
  const uid =
    (currentUserId && currentUserId.trim()) ||
    (() => {
      try {
        const x = localStorage.getItem(USER_ID_KEY);
        if (x && x.trim()) return x.trim();
      } catch {}
      const created = `u_${safeId()}`;
      try {
        localStorage.setItem(USER_ID_KEY, created);
      } catch {}
      return created;
    })();

  const acc =
    (currentAccountId && currentAccountId.trim()) ||
    (() => {
      try {
        const x = localStorage.getItem(ACCOUNT_ID_KEY);
        if (x && x.trim()) return x.trim();
      } catch {}
      const created = `acc_${safeId()}`;
      try {
        localStorage.setItem(ACCOUNT_ID_KEY, created);
      } catch {}
      return created;
    })();

  try {
    localStorage.setItem(USER_ID_KEY, uid);
    localStorage.setItem(ACCOUNT_ID_KEY, acc);
  } catch {}

  return { uid, acc };
}

// Strict read (no auto-create) — for Billing Portal!
function readIds() {
  try {
    const uid = (localStorage.getItem(USER_ID_KEY) || "").trim();
    const acc = (localStorage.getItem(ACCOUNT_ID_KEY) || "").trim();
    return { uid, acc };
  } catch {
    return { uid: "", acc: "" };
  }
}

function outLangLabel(lang: UiLang, uiLang: UiLang) {
  if (uiLang === "en") return lang === "de" ? "German" : "English";
  return lang === "de" ? "Deutsch" : "Englisch";
}

function outLangForBackend(lang: UiLang) {
  return lang === "de" ? "Deutsch" : "English";
}

function normalizeMe(data: MeResponseAny): {
  plan: Plan;
  used: number;
  limit: number;
  renewAtMs: number | null;
  byokOnly: boolean;
  stripe: {
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number | null;
    lastInvoiceStatus: string;
  };
} {
  const plan: Plan = data?.plan === "PRO" ? "PRO" : "FREE";

  const limits: Limits = (data as any)?.limits || DEFAULT_LIMITS;
  const limit =
    typeof (data as any)?.limit === "number"
      ? Number((data as any).limit)
      : plan === "PRO"
      ? Number(limits?.pro ?? DEFAULT_LIMITS.pro)
      : Number(limits?.free ?? DEFAULT_LIMITS.free);

  const v2Usage = (data as MeResponseV2)?.usage;
  const used =
    typeof v2Usage?.used === "number"
      ? v2Usage.used
      : typeof (data as MeResponseLegacy)?.usage === "number"
      ? (data as MeResponseLegacy).usage || 0
      : 0;

  let renewAtMs: number | null = null;
  if (typeof v2Usage?.renewAt === "number") renewAtMs = v2Usage.renewAt;
  else {
    const raw = String((data as MeResponseLegacy)?.usageRenewDate || "").trim();
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) renewAtMs = d.getTime();
    }
  }

  const byokOnly =
    typeof (data as any)?.byokOnly === "boolean"
      ? !!(data as any).byokOnly
      : false;

  const s = ((data as any)?.stripe || {}) as StripeInfo;
  const stripe = {
    status: String(s?.status || ""),
    cancelAtPeriodEnd: !!s?.cancelAtPeriodEnd,
    currentPeriodEnd:
      typeof s?.currentPeriodEnd === "number" ? s.currentPeriodEnd : null,
    lastInvoiceStatus: String(s?.lastInvoiceStatus || ""),
  };

  return { plan, used, limit, renewAtMs, byokOnly, stripe };
}

/* =========================
   UI Styles
========================= */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#050608",
  color: "#e8e8ee",
  padding: 24,
};

const wrapStyle: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  display: "grid",
  gap: 14,
};

const cardStyle: React.CSSProperties = {
  background: "#0b0c10",
  border: "1px solid #202230",
  borderRadius: 16,
  padding: 16,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #202230",
  background: "#0f1118",
  color: "#e8e8ee",
  cursor: "pointer",
};

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  border: "1px solid #2b3a2b",
  background: "linear-gradient(90deg,#166534,#14532d)",
  fontWeight: 800,
};

const miniBtnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #202230",
  background: "#0f1118",
  color: "#e8e8ee",
  cursor: "pointer",
};

const pill = (ok: boolean): React.CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #202230",
  background: ok ? "rgba(20,83,45,.35)" : "rgba(185,28,28,.25)",
  color: "#e8e8ee",
  fontSize: 12,
  display: "inline-flex",
  gap: 8,
  alignItems: "center",
});

const toggleWrap: React.CSSProperties = {
  display: "inline-flex",
  border: "1px solid #202230",
  borderRadius: 999,
  overflow: "hidden",
};

const toggleBtn = (active: boolean): React.CSSProperties => ({
  padding: "6px 10px",
  fontSize: 12,
  border: "none",
  background: active ? "#161a27" : "transparent",
  color: "#e8e8ee",
  cursor: "pointer",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #202230",
  background: "#050608",
  color: "#e8e8ee",
};

const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.8 };

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  zIndex: 9999,
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "#0b0c10",
  border: "1px solid #202230",
  borderRadius: 16,
  padding: 16,
};

/* =========================
   Page
========================= */

export default function Page() {
  const sp = useSearchParams();

  const [uiLang, setUiLang] = useState<UiLang>("de");
  const [outLang, setOutLang] = useState<UiLang>("de");
  const t = TXT[uiLang];

  const [backendStatus, setBackendStatus] = useState<BackendStatus>("unknown");
  const [healthModel, setHealthModel] = useState<string>("");
  const [healthBuildTag, setHealthBuildTag] = useState<string>("");
  const [byokOnly, setByokOnly] = useState(false);
  const [models, setModels] = useState<{
    byok: string;
    pro: string;
    boost: string;
  }>({
    byok: "gpt-4o-mini",
    pro: "gpt-4o-mini",
    boost: "gpt-5",
  });

  const [plan, setPlan] = useState<Plan>("FREE");
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMITS.free);
  const [renewLabel, setRenewLabel] = useState<string>("");

  // Stripe-visible status
  const [stripeStatus, setStripeStatus] = useState<string>("");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<number | null>(null);
  const [lastInvoiceStatus, setLastInvoiceStatus] = useState<string>("");

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "ok" | "bad">("idle");
  const [keyMsg, setKeyMsg] = useState("");

  const [useCase, setUseCase] = useState("Social Media Post");
  const [tone, setTone] = useState("Neutral");
  const [topic, setTopic] = useState("");
  const [extra, setExtra] = useState("");
  const [boost, setBoost] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const [showProModal, setShowProModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showMissingIdsModal, setShowMissingIdsModal] = useState(false);

  const [restoreSessionId, setRestoreSessionId] = useState("");
  const [lastSessionId, setLastSessionId] = useState("");

  const isPro = plan === "PRO";
  const progress = useMemo(() => safePercent(used, limit), [used, limit]);

  /* -------------------------
     Load local settings
  -------------------------- */
  useEffect(() => {
    try {
      const storedUi = (
        localStorage.getItem(UI_LANG_KEY) || ""
      ).trim() as UiLang;
      const storedOut = (
        localStorage.getItem(OUT_LANG_KEY) || ""
      ).trim() as UiLang;
      const storedKey = (localStorage.getItem(APIKEY_STORAGE_KEY) || "").trim();
      const storedPlan = (
        localStorage.getItem(PLAN_STORAGE_KEY) || ""
      ).trim() as Plan;
      const storedHistory = safeJsonParse<HistoryEntry[]>(
        localStorage.getItem(HISTORY_STORAGE_KEY)
      );
      const storedLastSession = (
        localStorage.getItem(LAST_SESSION_ID_KEY) || ""
      ).trim();

      if (storedUi === "de" || storedUi === "en") setUiLang(storedUi);
      if (storedOut === "de" || storedOut === "en") setOutLang(storedOut);
      if (storedKey) setApiKey(storedKey);
      if (storedPlan === "FREE" || storedPlan === "PRO") setPlan(storedPlan);
      if (Array.isArray(storedHistory))
        setHistory(storedHistory.slice(0, MAX_HISTORY));
      if (storedLastSession) setLastSessionId(storedLastSession);
    } catch {}
  }, []);

  /* -------------------------
     Persist local settings
  -------------------------- */
  useEffect(() => {
    try {
      localStorage.setItem(UI_LANG_KEY, uiLang);
    } catch {}
  }, [uiLang]);

  useEffect(() => {
    try {
      localStorage.setItem(OUT_LANG_KEY, outLang);
    } catch {}
  }, [outLang]);

  useEffect(() => {
    try {
      localStorage.setItem(APIKEY_STORAGE_KEY, apiKey.trim());
    } catch {}
  }, [apiKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(history.slice(0, MAX_HISTORY))
      );
    } catch {}
  }, [history]);

  useEffect(() => {
    try {
      if (lastSessionId)
        localStorage.setItem(LAST_SESSION_ID_KEY, lastSessionId);
    } catch {}
  }, [lastSessionId]);

  /* -------------------------
     Health
  -------------------------- */
  async function refreshHealth() {
    try {
      const r = await fetch(ENDPOINTS.health, { method: "GET" });
      const data = (await r.json().catch(() => ({}))) as HealthResponse;

      if (!r.ok) {
        setBackendStatus("down");
        return;
      }

      setBackendStatus("ok");
      setHealthModel(String(data?.service || "ok"));
      setHealthBuildTag(String(data?.buildTag || ""));
      if (typeof data?.byokOnly === "boolean") setByokOnly(!!data.byokOnly);

      const mb = String(data?.models?.byok || models.byok);
      const mp = String(data?.models?.pro || models.pro);
      const mboost = String(data?.models?.boost || models.boost);
      setModels({ byok: mb, pro: mp, boost: mboost });
    } catch {
      setBackendStatus("down");
    }
  }

  /* -------------------------
     /me
  -------------------------- */
  async function refreshMe() {
    try {
      const { uid, acc } = ensureIdsNow();

      const r = await fetch(ENDPOINTS.me, {
        method: "GET",
        headers: {
          "x-gle-user": uid,
          "x-gle-account-id": acc,
        },
      });

      const data = (await r.json().catch(() => ({}))) as MeResponseAny;
      if (!r.ok) return;

      const n = normalizeMe(data);

      setPlan(n.plan);
      setUsed(n.used);
      setLimit(n.limit);
      setByokOnly(
        typeof (data as any)?.byokOnly === "boolean" ? n.byokOnly : byokOnly
      );

      if (n.renewAtMs) {
        const d = new Date(n.renewAtMs);
        setRenewLabel(
          uiLang === "de"
            ? `${t.resetOn} ${formatGermanDate(d)}`
            : `${t.resetOn} ${d.toLocaleDateString()}`
        );
      } else {
        setRenewLabel("");
      }

      setStripeStatus(n.stripe.status);
      setCancelAtPeriodEnd(n.stripe.cancelAtPeriodEnd);
      setCurrentPeriodEnd(n.stripe.currentPeriodEnd);
      setLastInvoiceStatus(n.stripe.lastInvoiceStatus);

      try {
        localStorage.setItem(PLAN_STORAGE_KEY, n.plan);
      } catch {}
    } catch {}
  }

  /* -------------------------
     Mount
  -------------------------- */
  useEffect(() => {
    refreshHealth();
    refreshMe();

    const id = setInterval(() => {
      refreshHealth();
    }, 15000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------
     Return from billing/paid → refresh twice + clean URL
  -------------------------- */
  useEffect(() => {
    const fromBilling = sp.get("from") === "billing";
    const paid = sp.get("paid") === "1";
    if (!fromBilling && !paid) return;

    refreshMe();
    const tmr = window.setTimeout(() => refreshMe(), 1200);

    // clean URL
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("from");
      url.searchParams.delete("paid");
      const next =
        url.pathname +
        (url.search ? url.search : "") +
        (url.hash ? url.hash : "");
      window.history.replaceState({}, "", next);
    } catch {}

    return () => window.clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  /* -------------------------
     If session_id in URL → open restore modal
  -------------------------- */
  useEffect(() => {
    const sid = String(sp.get("session_id") || "").trim();
    if (!sid) return;

    setRestoreSessionId(sid);
    setShowRestoreModal(true);

    // clean URL
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname + url.search);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  /* -------------------------
     Key test
  -------------------------- */
  async function testKey() {
    setKeyStatus("idle");
    setKeyMsg("");

    try {
      const k = apiKey.trim();
      const r = await fetch(ENDPOINTS.testKey, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(k ? { "x-openai-key": k } : {}),
        },
        body: JSON.stringify({}),
      });

      const data = await r.json().catch(() => ({} as any));

      if (r.ok) {
        setKeyStatus("ok");
        setKeyMsg(String(data?.message || "OK"));
      } else {
        setKeyStatus("bad");
        setKeyMsg(String(data?.message || data?.error || "invalid_key"));
      }
    } catch {
      setKeyStatus("bad");
      setKeyMsg("network_error");
    }
  }

  /* -------------------------
     Stripe: Checkout
  -------------------------- */
  async function openCheckout() {
    setError("");
    try {
      const { uid, acc } = ensureIdsNow();
      const r = await fetch(ENDPOINTS.checkout, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gle-user": uid,
          "x-gle-account-id": acc,
        },
        body: JSON.stringify({}),
      });

      const data = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        setError(String(data?.error || "checkout_error"));
        return;
      }

      const url = String(data?.url || "").trim();
      const sid = String(data?.sessionId || "").trim();
      if (sid) setLastSessionId(sid);

      if (url) window.location.href = url;
    } catch {
      setError("network_error");
    }
  }

  /* -------------------------
     Stripe: Billing Portal (STRICT IDs)
  -------------------------- */
  async function openBillingPortal() {
    try {
      const acc = (localStorage.getItem("gle_account_id_v1") || "").trim();
      const uid = (localStorage.getItem("gle_user_id_v1") || "").trim();

      if (!acc || !uid) {
        throw new Error("Missing accountId/userId in localStorage.");
      }

      // ✅ WICHTIG: richtiger Endpoint
      const r = await fetch(ENDPOINTS.billingPortal, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gle-account-id": acc,
          "x-gle-user": uid,
          // optional: manche Stellen schicken das zusätzlich
          "x-gle-acc": acc,
        },
        body: JSON.stringify({}),
      });

      const data = await r.json().catch(() => ({} as any));

      if (!r.ok || !data?.url) {
        // Backend gibt bei fehlendem customerId z.B. missing_customer_id / no_customer zurück
        throw new Error(
          data?.message || data?.error || `portal_failed (${r.status})`
        );
      }

      // ✅ Weiterleitung ins Stripe Portal
      window.location.href = data.url as string;
    } catch (e: any) {
      console.error(e);
      // Wenn du ein setError/toast hast, hier nutzen – sonst erstmal alert:
      alert(e?.message || "Billing portal failed");
    }
  }

  /* -------------------------
     Sync: by session_id (restore flow)
  -------------------------- */
  async function syncBySessionId(sessionIdRaw?: string) {
    setError("");

    const sessionId = String(sessionIdRaw || "").trim();
    if (!sessionId) {
      setError("missing_session_id");
      return;
    }

    try {
      const ids = ensureIdsNow();
      const r = await fetch(ENDPOINTS.syncCheckout, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gle-user": ids.uid,
          "x-gle-account-id": ids.acc,
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        setError(String(data?.message || data?.error || "sync_error"));
        return;
      }

      await refreshMe();
      setShowRestoreModal(false);
      setRestoreSessionId("");
    } catch {
      setError("network_error");
    }
  }

  /* -------------------------
     Generate
  -------------------------- */
  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOutput("");
    setCopyState("idle");

    const topicTrim = topic.trim();
    if (!topicTrim) {
      setError("missing_topic");
      return;
    }

    const { uid, acc } = ensureIdsNow();

    const started = Date.now();
    setIsGenerating(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-gle-user": uid,
        "x-gle-account-id": acc,
      };

      const k = apiKey.trim();
      if (k) headers["x-openai-key"] = k;

      const payload = {
        useCase,
        tone,
        language: outLangForBackend(outLang),
        topic: topicTrim,
        extra: extra.trim(),
        boost: !!boost,
      };

      const r = await fetch(ENDPOINTS.generate, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({} as any));

      // Minimum UX time
      const min = isPro ? MIN_GEN_PRO_MS : MIN_GEN_FREE_MS;
      const elapsed = Date.now() - started;
      if (elapsed < min) await sleep(min - elapsed);

      if (!r.ok) {
        const code = String(data?.error || "generate_error");
        const msg = String(data?.message || "");

        if (code === "quota_reached" && !isPro) setShowProModal(true);

        setError(msg || code);
        return;
      }

      const text = pickOutput(data);
      if (!text) {
        setError("no_text");
        return;
      }

      setOutput(text);
      refreshMe();

      const entry: HistoryEntry = {
        id: `h_${safeId()}`,
        timestamp: Date.now(),
        useCase,
        tone,
        outLang,
        topic: topicTrim,
        extra: extra.trim(),
        boost: !!boost,
        result: text,
        meta: {
          model: data?.meta?.model,
          tokens: data?.meta?.tokens,
          boost: data?.meta?.boost,
          plan: data?.meta?.plan,
          isBYOK: data?.meta?.isBYOK,
          usingServerKey: data?.meta?.usingServerKey,
          requestId: data?.meta?.requestId,
          buildTag: data?.meta?.buildTag,
        },
      };

      setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
    } catch {
      setError("network_error");
    } finally {
      setIsGenerating(false);
    }
  }

  /* -------------------------
     Copy helpers
  -------------------------- */
  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 1200);
      } catch {}
    }
  }

  function clearHistory() {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {}
  }

  const cancelLabel =
    cancelAtPeriodEnd && currentPeriodEnd
      ? uiLang === "de"
        ? `${t.cancelScheduled} ${formatGermanDate(new Date(currentPeriodEnd))}`
        : `${t.cancelScheduled} ${new Date(
            currentPeriodEnd
          ).toLocaleDateString()}`
      : "";

  const stripeOk =
    stripeStatus === "active" ||
    stripeStatus === "trialing" ||
    stripeStatus === "past_due";

  /* =========================
     Render
  ========================= */

  return (
    <div style={pageStyle}>
      <div style={wrapStyle}>
        {/* Header */}
        <div
          style={{
            ...cardStyle,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{t.title}</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>{t.subtitle}</div>

            <div style={{ marginTop: 10, ...rowStyle }}>
              <span style={pill(backendStatus === "ok")}>
                {backendStatus === "ok"
                  ? "✅"
                  : backendStatus === "down"
                  ? "❌"
                  : "…"}{" "}
                {t.backend}:{" "}
                {backendStatus === "ok"
                  ? "OK"
                  : backendStatus === "down"
                  ? "DOWN"
                  : "…"}
              </span>

              <span style={pill(plan === "PRO")}>
                {plan === "PRO" ? "👑" : "🆓"}{" "}
                {plan === "PRO" ? t.planPro : t.planFree}
              </span>

              <span style={pill(!byokOnly)}>
                {byokOnly ? "🔒" : "🔓"} {t.byok}:{" "}
                {byokOnly ? "Only" : "Optional"}
              </span>

              {!!stripeStatus && (
                <span style={pill(stripeOk)}>
                  {t.stripeLabel}: {stripeStatus}
                  {lastInvoiceStatus ? ` (${lastInvoiceStatus})` : ""}
                </span>
              )}

              {!!cancelLabel && (
                <span style={pill(true)}>⏳ {cancelLabel}</span>
              )}

              {healthBuildTag ? (
                <span style={{ ...pill(true), opacity: 0.85 }}>
                  🏷️ {healthBuildTag}
                </span>
              ) : null}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Models: BYOK={models.byok} · PRO={models.pro} · BOOST=
              {models.boost} {healthModel ? `· ${healthModel}` : ""}
            </div>
          </div>

          {/* UI / Output language toggles */}
          <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>{t.ui}</div>
              <div style={toggleWrap}>
                <button
                  style={toggleBtn(uiLang === "de")}
                  onClick={() => setUiLang("de")}
                  type="button"
                >
                  DE
                </button>
                <button
                  style={toggleBtn(uiLang === "en")}
                  onClick={() => setUiLang("en")}
                  type="button"
                >
                  EN
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={labelStyle}>{t.output}</div>
              <div style={toggleWrap}>
                <button
                  style={toggleBtn(outLang === "de")}
                  onClick={() => setOutLang("de")}
                  type="button"
                >
                  {outLangLabel("de", uiLang)}
                </button>
                <button
                  style={toggleBtn(outLang === "en")}
                  onClick={() => setOutLang("en")}
                  type="button"
                >
                  {outLangLabel("en", uiLang)}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions + Usage */}
        <div style={cardStyle}>
          <div style={rowStyle}>
            <button
              style={primaryBtnStyle}
              onClick={openCheckout}
              type="button"
            >
              {t.checkoutOpen}
            </button>

            <button style={btnStyle} onClick={openBillingPortal} type="button">
              {t.manage}
            </button>

            <button style={btnStyle} onClick={() => refreshMe()} type="button">
              {t.sync}
            </button>

            <button
              style={btnStyle}
              onClick={() => setShowRestoreModal(true)}
              type="button"
            >
              {t.restore}
            </button>

            {SHOW_DEV ? (
              <button
                style={btnStyle}
                onClick={() => {
                  setError("");
                  setOutput("");
                }}
                type="button"
              >
                Clear UI
              </button>
            ) : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {used}/{limit} · {renewLabel || ""}
            </div>
            <div
              style={{
                marginTop: 8,
                height: 10,
                borderRadius: 999,
                border: "1px solid #202230",
                overflow: "hidden",
                background: "#0a0b10",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg,#1f2937,#16a34a)",
                }}
              />
            </div>
          </div>

          {error ? (
            <div style={{ marginTop: 10, color: "#ffb4a8", fontSize: 13 }}>
              ❌ {error}
            </div>
          ) : null}
        </div>

        {/* BYOK Key */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 900 }}>{t.apiKeyTitle}</div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-proj-…"
              type={showKey ? "text" : "password"}
              style={{ flex: 1, minWidth: 260, ...inputStyle }}
            />

            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              style={miniBtnStyle}
            >
              {showKey ? t.hide : t.show}
            </button>

            <button type="button" onClick={testKey} style={miniBtnStyle}>
              {t.test}
            </button>
          </div>

          {(keyStatus !== "idle" || keyMsg) && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#cfd2dc" }}>
              {keyStatus === "ok" ? "✅ " : keyStatus === "bad" ? "❌ " : ""}
              {keyMsg}
            </div>
          )}

          {!apiKey.trim() && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: byokOnly ? "#ffb4a8" : "#9ca0b4",
              }}
            >
              {byokOnly ? t.keyHintByokOnly : t.keyHintNoKey}
            </div>
          )}
        </div>

        {/* Generator */}
        <form style={cardStyle} onSubmit={onGenerate}>
          <div style={{ fontWeight: 900 }}>Generator</div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div>
              <div style={labelStyle}>{t.useCase}</div>
              <input
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={labelStyle}>{t.tone}</div>
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={labelStyle}>{t.topic}</div>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              />
            </div>

            <div>
              <div style={labelStyle}>{t.extra}</div>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  gap: 10,
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={boost}
                  onChange={(e) => setBoost(e.target.checked)}
                />
                <span style={{ fontWeight: 800 }}>
                  {t.boost}{" "}
                  <span style={{ opacity: 0.75, fontWeight: 600 }}>
                    ({t.boostHint})
                  </span>
                </span>
              </label>
            </div>

            <div style={rowStyle}>
              <button
                type="submit"
                style={primaryBtnStyle}
                disabled={isGenerating}
              >
                {isGenerating ? t.generating : t.generate}
              </button>
            </div>
          </div>
        </form>

        {/* Output */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 900 }}>{t.outputTitle}</div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                style={miniBtnStyle}
                onClick={() => copyText(output)}
                disabled={!output}
              >
                {copyState === "copied" ? t.copied : t.copy}
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              whiteSpace: "pre-wrap",
              lineHeight: 1.45,
              opacity: output ? 1 : 0.7,
            }}
          >
            {output || "…"}
          </div>
        </div>

        {/* History */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 900 }}>{t.historyTitle}</div>
            <button
              type="button"
              style={miniBtnStyle}
              onClick={clearHistory}
              disabled={!history.length}
            >
              {t.clearHistory}
            </button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {history.length === 0 ? (
              <div style={{ opacity: 0.7, fontSize: 13 }}>—</div>
            ) : (
              history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    border: "1px solid #202230",
                    borderRadius: 14,
                    padding: 12,
                    background: "#07080d",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {new Date(h.timestamp).toLocaleString()} · {h.useCase} ·{" "}
                      {h.tone} · {outLangLabel(h.outLang, uiLang)} ·{" "}
                      {h.boost ? "BOOST" : "—"}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        style={miniBtnStyle}
                        onClick={() => copyText(h.result)}
                      >
                        {t.copy}
                      </button>
                      <button
                        type="button"
                        style={miniBtnStyle}
                        onClick={() => setOutput(h.result)}
                      >
                        Load
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
                    <div style={{ opacity: 0.85, fontWeight: 700 }}>Topic</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{h.topic}</div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      opacity: 0.92,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {h.result.slice(0, 450)}
                    {h.result.length > 450 ? "…" : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PRO Modal */}
      {showProModal ? (
        <div style={modalOverlay} onClick={() => setShowProModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900 }}>{t.proModalTitle}</div>
              <button
                style={miniBtnStyle}
                type="button"
                onClick={() => setShowProModal(false)}
              >
                {t.close}
              </button>
            </div>

            <div
              style={{ marginTop: 10, whiteSpace: "pre-wrap", opacity: 0.9 }}
            >
              {t.proModalText}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                style={btnStyle}
                type="button"
                onClick={() => setShowProModal(false)}
              >
                {t.later}
              </button>
              <button
                style={primaryBtnStyle}
                type="button"
                onClick={openCheckout}
              >
                {t.getPro}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Restore Modal */}
      {showRestoreModal ? (
        <div style={modalOverlay} onClick={() => setShowRestoreModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900 }}>{t.restoreTitle}</div>
              <button
                style={miniBtnStyle}
                type="button"
                onClick={() => setShowRestoreModal(false)}
              >
                {t.close}
              </button>
            </div>

            <div
              style={{ marginTop: 10, whiteSpace: "pre-wrap", opacity: 0.9 }}
            >
              {t.restoreText}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={labelStyle}>{t.sessionIdLabel}</div>
              <input
                value={restoreSessionId}
                onChange={(e) => setRestoreSessionId(e.target.value)}
                placeholder="cs_test_..."
                style={inputStyle}
              />
              {lastSessionId ? (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                  Last sessionId:{" "}
                  <button
                    type="button"
                    style={{ ...miniBtnStyle, padding: "6px 10px" }}
                    onClick={() => setRestoreSessionId(lastSessionId)}
                  >
                    Use saved
                  </button>
                </div>
              ) : null}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                style={btnStyle}
                type="button"
                onClick={() => syncBySessionId(restoreSessionId)}
              >
                {t.restoreSync}
              </button>
              <button
                style={primaryBtnStyle}
                type="button"
                onClick={openCheckout}
              >
                {t.restoreCheckout}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Missing IDs Modal */}
      {showMissingIdsModal ? (
        <div style={modalOverlay} onClick={() => setShowMissingIdsModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900 }}>{t.missingIdsTitle}</div>
              <button
                style={miniBtnStyle}
                type="button"
                onClick={() => setShowMissingIdsModal(false)}
              >
                {t.close}
              </button>
            </div>

            <div
              style={{ marginTop: 10, opacity: 0.9, whiteSpace: "pre-wrap" }}
            >
              {t.missingIdsText}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                style={btnStyle}
                type="button"
                onClick={() => setShowMissingIdsModal(false)}
              >
                {t.ok}
              </button>
              <button
                style={primaryBtnStyle}
                type="button"
                onClick={() => {
                  setShowMissingIdsModal(false);
                  setShowRestoreModal(true);
                }}
              >
                {t.restore}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
