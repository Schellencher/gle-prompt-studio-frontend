// app/page.tsx — GLE Prompt Studio Frontend (FINAL)
// - Dropdowns for Use Case + Tone (with optional custom fields)
// - DE/EN UI + DE/EN output language
// - BYOK key storage + Test
// - Checkout + Billing Portal + Sync (session_id) + Restore modal
// - Usage + limits + models from /api/health + /api/me
// - History (localStorage) + Copy output
// - Auto-capture ?session_id=... from URL (no console noise)

"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";

/* =========================
   Config
========================= */

const API_BASE = String(process.env.NEXT_PUBLIC_API_BASE || "").trim()
  ? String(process.env.NEXT_PUBLIC_API_BASE).trim()
  : "https://gle-prompt-studio-backend-1.onrender.com";

const ENDPOINTS = {
  health: `${API_BASE}/api/health`,
  me: `${API_BASE}/api/me`,
  testKey: `${API_BASE}/api/test`,

  checkout: `${API_BASE}/api/create-checkout-session`,
  generate: `${API_BASE}/api/generate`,
  sync: `${API_BASE}/api/sync-checkout-session`,

  billingPortal: `${API_BASE}/api/billing-portal`,
  billingPortalFallback: `${API_BASE}/api/create-portal-session`,
} as const;

/* =========================
   Storage Keys
========================= */

const USER_ID_KEY = "gle_user_id_v1";
const ACCOUNT_ID_KEY = "gle_account_id_v1";
const APIKEY_STORAGE_KEY = "gle_api_key_v1";
const UI_LANG_KEY = "gle_ui_lang_v1";
const OUT_LANG_KEY = "gle_out_lang_v1";
const PLAN_STORAGE_KEY = "gle_plan_v1";
const HISTORY_STORAGE_KEY = "gle_history_v1";
const LAST_SESSION_ID_KEY = "gle_last_checkout_session_id_v1";

// NEW: dropdown persistence
const USECASE_KEY_KEY = "gle_usecase_key_v1";
const USECASE_CUSTOM_KEY = "gle_usecase_custom_v1";
const TONE_KEY_KEY = "gle_tone_key_v1";
const TONE_CUSTOM_KEY = "gle_tone_custom_v1";

const MAX_HISTORY = 10;

/* =========================
   Types
========================= */

type UiLang = "de" | "en";
type OutLang = "de" | "en";
type Plan = "FREE" | "PRO";
type BackendStatus = "unknown" | "ok" | "down";

type Health = {
  status?: string;
  byokOnly?: boolean;
  stripe?: boolean;
  stripeMode?: string;
  stripePriceId?: string;
  models?: { byok?: string; pro?: string; boost?: string };
  limits?:
    | { free?: number; pro?: number }
    | { FREE_LIMIT?: number; PRO_LIMIT?: number };
};

type MeResp = {
  ok?: boolean;
  plan?: Plan;

  renewAt?: number;
  cancelAt?: number;

  stripe?: {
    mode?: string;
    customerId?: string;
    subscriptionId?: string;
    hasCustomerId?: boolean;
  };

  usage?: {
    used?: number;
    count?: number;
    tokens?: number;
    lastTs?: number;
    monthKey?: string;
  };

  limits?:
    | { free?: number; pro?: number }
    | { FREE_LIMIT?: number; PRO_LIMIT?: number };
};

type HistoryEntry = {
  id: string;
  timestamp: number;
  useCase: string;
  tone: string;
  topic: string;
  extra: string;
  outLang: OutLang;
  boost: boolean;
  result: string;
};

type Opt = { key: string; label: { de: string; en: string } };

/* =========================
   Dropdown Options
========================= */

const USE_CASES: Opt[] = [
  {
    key: "social_media_post",
    label: { de: "Social Media Post", en: "Social media post" },
  },
  { key: "linkedin_post", label: { de: "LinkedIn Post", en: "LinkedIn post" } },
  { key: "blog_article", label: { de: "Blog-Artikel", en: "Blog article" } },
  {
    key: "product_description",
    label: { de: "Produktbeschreibung", en: "Product description" },
  },
  {
    key: "newsletter",
    label: { de: "Newsletter / E-Mail", en: "Newsletter / email" },
  },
  {
    key: "landingpage",
    label: {
      de: "Landingpage / Website-Text",
      en: "Landing page / website copy",
    },
  },
  {
    key: "ad_copy",
    label: { de: "Werbeanzeige (Meta/Google)", en: "Ad copy (Meta/Google)" },
  },
  {
    key: "video_script",
    label: {
      de: "Video Script (Reels/TikTok/YouTube)",
      en: "Video script (Reels/TikTok/YouTube)",
    },
  },
  {
    key: "seo_meta",
    label: {
      de: "SEO Meta Title + Description",
      en: "SEO meta title + description",
    },
  },
  {
    key: "hook_headlines",
    label: { de: "Hooks / Headlines", en: "Hooks / headlines" },
  },
  {
    key: "offer_outline",
    label: { de: "Angebot / Sales-Outline", en: "Offer / sales outline" },
  },
  { key: "custom", label: { de: "Eigener…", en: "Custom…" } },
];

const TONES: Opt[] = [
  { key: "neutral", label: { de: "Neutral", en: "Neutral" } },
  { key: "friendly", label: { de: "Freundlich", en: "Friendly" } },
  { key: "professional", label: { de: "Professionell", en: "Professional" } },
  { key: "casual", label: { de: "Locker", en: "Casual" } },
  { key: "persuasive", label: { de: "Überzeugend", en: "Persuasive" } },
  { key: "emotional", label: { de: "Emotional", en: "Emotional" } },
  { key: "humorous", label: { de: "Humorvoll", en: "Humorous" } },
  { key: "authoritative", label: { de: "Autoritativ", en: "Authoritative" } },
  { key: "direct", label: { de: "Direkt / Kurz", en: "Direct / concise" } },
  { key: "storytelling", label: { de: "Storytelling", en: "Storytelling" } },
  { key: "custom", label: { de: "Eigener…", en: "Custom…" } },
];

function optLabel(opts: Opt[], key: string, lang: OutLang) {
  const hit = opts.find((o) => o.key === key);
  return (hit ? hit.label[lang] : "") || "";
}

/* =========================
   i18n
========================= */

const TXT: Record<
  UiLang,
  {
    title: string;
    subtitle: string;

    backend: string;
    byok: string;
    plan: string;
    stripeLabel: string;

    checkoutOpen: string;
    manage: string;
    sync: string;
    restore: string;

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
    outputLang: string;

    customUseCase: string;
    customTone: string;

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
    cancelScheduled: string;

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

    portalError: string;
    missingSession: string;
    synced: string;

    noKeySet: string;
    portalNeedsCustomer: string;

    pickValue: string;
    customMissing: string;
  }
> = {
  de: {
    title: "GLE Prompt Studio",
    subtitle:
      "Master-Prompts für Social Media, Blog, Produkttexte & Newsletter.",

    backend: "Backend",
    byok: "BYOK",
    plan: "Plan",
    stripeLabel: "Stripe",

    checkoutOpen: "Checkout öffnen",
    manage: "Abo verwalten",
    sync: "Sync",
    restore: "Account wiederherstellen",

    apiKeyTitle: "OpenAI API-Key (BYOK)",
    show: "Anzeigen",
    hide: "Ausblenden",
    test: "Testen",
    keyHintByokOnly:
      "Hinweis: BYOK-Only aktiv. Ohne eigenen Key kann FREE nicht generieren.",
    keyHintNoKey:
      "Hinweis: Kein Key gesetzt. PRO kann trotzdem laufen (Server-Credits), wenn dein Account PRO ist.",

    useCase: "Anwendungsfall",
    tone: "Ton",
    topic: "Thema / Kontext",
    extra: "Extra Hinweise (z.B. „3 Varianten, Hook + CTA“)",
    outputLang: "Output-Sprache",

    customUseCase: "Eigener Anwendungsfall",
    customTone: "Eigener Ton",

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
    cancelScheduled: "gekündigt zum",

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

    portalError: "Billing-Portal Fehler",
    missingSession: "Keine session_id vorhanden.",
    synced: "Sync erfolgreich.",

    noKeySet: "Kein Key gesetzt.",
    portalNeedsCustomer:
      "Stripe Customer fehlt (missing_customer_id). → Bitte einmal Checkout starten ODER per session_id syncen.",

    pickValue: "Bitte auswählen…",
    customMissing: "Bitte fülle das Feld „Eigener …“ aus.",
  },
  en: {
    title: "GLE Prompt Studio",
    subtitle:
      "Master prompts for social media, blogs, product copy & newsletters.",

    backend: "Backend",
    byok: "BYOK",
    plan: "Plan",
    stripeLabel: "Stripe",

    checkoutOpen: "Open checkout",
    manage: "Manage subscription",
    sync: "Sync",
    restore: "Restore account",

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
    extra: "Extra notes (e.g. “3 variants, hook + CTA”)",
    outputLang: "Output language",

    customUseCase: "Custom use case",
    customTone: "Custom tone",

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
    cancelScheduled: "cancels on",

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

    portalError: "Billing Portal error",
    missingSession: "No session_id available.",
    synced: "Sync successful.",

    noKeySet: "No key set.",
    portalNeedsCustomer:
      "Stripe customer missing (missing_customer_id). → Start checkout once OR sync via session_id.",

    pickValue: "Please choose…",
    customMissing: "Please fill the “Custom …” field.",
  },
};

/* =========================
   Small helpers
========================= */

function safeGet(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function randomId(prefix: string) {
  const webCrypto = (globalThis as any).crypto as Crypto | undefined;
  if (webCrypto?.getRandomValues) {
    const bytes = new Uint8Array(8);
    webCrypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${prefix}_${hex}`;
  }
  return `${prefix}_${Math.random().toString(16).slice(2)}${Math.random()
    .toString(16)
    .slice(2)}`.slice(0, 28);
}

function normalizeTs(ts?: number) {
  if (!ts) return 0;
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

function formatDate(ts?: number, lang: UiLang = "de") {
  const n = normalizeTs(ts);
  if (!n) return "";
  try {
    const d = new Date(n);
    return d.toLocaleDateString(lang === "de" ? "de-DE" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

async function readJsonOrText(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json().catch(() => ({}));
  }
  const text = await res.text().catch(() => "");
  return { _text: text };
}

async function fetchJsonTry(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await readJsonOrText(res);
  return { res, data };
}

function headersWithIds(uid: string, acc: string, apiKey?: string) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "x-gle-user": uid,
    "x-gle-account-id": acc,
  };
  if (apiKey) h["x-gle-api-key"] = apiKey;
  return h;
}

function pickLimits(obj: any, fallbackFree: number, fallbackPro: number) {
  const free =
    Number(obj?.free ?? obj?.FREE_LIMIT ?? obj?.FREE ?? fallbackFree) ||
    fallbackFree;
  const pro =
    Number(obj?.pro ?? obj?.PRO_LIMIT ?? obj?.PRO ?? fallbackPro) ||
    fallbackPro;
  return { free, pro };
}

function pickUsed(obj: any) {
  const u = obj?.used ?? obj?.count ?? 0;
  const n = Number(u);
  return Number.isFinite(n) ? n : 0;
}

/* =========================
   Modal
========================= */

function Modal({
  title,
  children,
  onClose,
  closeLabel,
}: {
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
        zIndex: 50,
      }}
      onMouseDown={onClose}
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
          <div style={{ fontWeight: 900 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              borderRadius: 12,
              border: "1px solid #202230",
              background: "#0f1118",
              color: "#e7e7ff",
              padding: "6px 10px",
              cursor: "pointer",
            }}
            aria-label={closeLabel}
            title={closeLabel}
            type="button"
          >
            {closeLabel}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

/* =========================
   Page
========================= */

export default function Page() {
  const [uiLang, setUiLang] = useState<UiLang>("de");
  const [outLang, setOutLang] = useState<OutLang>("de");
  const t = TXT[uiLang];

  // backend
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("unknown");
  const [byokOnly, setByokOnly] = useState(false);
  const [stripeExtra, setStripeExtra] = useState("");
  const [models, setModels] = useState({
    byok: "gpt-4o-mini",
    pro: "gpt-4o-mini",
    boost: "gpt-4o",
  });
  const [limits, setLimits] = useState({ free: 25, pro: 250 });

  // account
  const [plan, setPlan] = useState<Plan>("FREE");
  const [renewAt, setRenewAt] = useState<number | undefined>(undefined);
  const [cancelAt, setCancelAt] = useState<number | undefined>(undefined);
  const [used, setUsed] = useState(0);

  const isPro = plan === "PRO";
  const limit = isPro ? limits.pro : limits.free;
  const progress = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  // api key
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "ok" | "bad">("idle");
  const [keyMsg, setKeyMsg] = useState("");

  // generator inputs (dropdown)
  const [useCaseKey, setUseCaseKey] = useState<string>("social_media_post");
  const [useCaseCustom, setUseCaseCustom] = useState<string>("");
  const [toneKey, setToneKey] = useState<string>("neutral");
  const [toneCustom, setToneCustom] = useState<string>("");

  const [topic, setTopic] = useState("");
  const [extra, setExtra] = useState("");
  const [boost, setBoost] = useState(false);

  // output
  const [output, setOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // ui messages
  const [error, setError] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  // history
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const outputRef = useRef<HTMLTextAreaElement | null>(null);

  // modals
  const [showProModal, setShowProModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showMissingIdsModal, setShowMissingIdsModal] = useState(false);

  // restore
  const [restoreSessionId, setRestoreSessionId] = useState("");
  const [lastSessionId, setLastSessionId] = useState("");

  const renewText = useMemo(() => {
    if (!renewAt) return "";
    return `${t.resetOn} ${formatDate(renewAt, uiLang)}`;
  }, [renewAt, uiLang, t.resetOn]);

  const cancelText = useMemo(() => {
    if (!cancelAt) return "";
    return `${t.cancelScheduled} ${formatDate(cancelAt, uiLang)}`;
  }, [cancelAt, uiLang, t.cancelScheduled]);

  function showToast(msg: string) {
    setToastMsg(msg);
    console.log("[GLE]", msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToastMsg(""), 2600);
  }

  function readIds() {
    const uid = safeGet(USER_ID_KEY).trim();
    const acc = safeGet(ACCOUNT_ID_KEY).trim();
    return { uid, acc };
  }

  function ensureIds() {
    const { uid, acc } = readIds();
    if (uid && acc) return { uid, acc };

    const newUid = uid || randomId("u");
    const newAcc = acc || randomId("acc");
    safeSet(USER_ID_KEY, newUid);
    safeSet(ACCOUNT_ID_KEY, newAcc);
    return { uid: newUid, acc: newAcc };
  }

  function applyMe(me: MeResp) {
    const newPlan = (me.plan || "FREE") as Plan;
    setPlan(newPlan);
    safeSet(PLAN_STORAGE_KEY, newPlan);

    setRenewAt(
      typeof me.renewAt === "number" ? normalizeTs(me.renewAt) : undefined
    );
    setCancelAt(
      typeof me.cancelAt === "number" ? normalizeTs(me.cancelAt) : undefined
    );

    if (me.limits) {
      const next = pickLimits(me.limits as any, limits.free, limits.pro);
      setLimits(next);
    }

    if (me.usage) setUsed(pickUsed(me.usage));

    const stripeMode = me.stripe?.mode
      ? String(me.stripe.mode).toUpperCase()
      : "";
    if (stripeMode) setStripeExtra(stripeMode);
  }

  async function loadHealth() {
    try {
      const { res, data } = await fetchJsonTry(ENDPOINTS.health, {
        method: "GET",
      });
      if (!res.ok) throw new Error("health_down");

      const h = data as Health;
      setBackendStatus("ok");
      setByokOnly(!!h.byokOnly);

      setModels({
        byok: h.models?.byok || "gpt-4o-mini",
        pro: h.models?.pro || "gpt-4o-mini",
        boost: h.models?.boost || "gpt-4o",
      });

      if (h.limits) setLimits(pickLimits(h.limits as any, 25, 250));

      const stripeInfo =
        h.stripe === false
          ? "disabled"
          : `${String(h.stripeMode || "").toUpperCase()}${
              h.stripePriceId ? ` · ${h.stripePriceId}` : ""
            }`.trim();

      if (stripeInfo) setStripeExtra(stripeInfo);
    } catch {
      setBackendStatus("down");
    }
  }

  async function loadMe() {
    const { uid, acc } = ensureIds();
    const key = safeGet(APIKEY_STORAGE_KEY).trim();

    try {
      const { res, data } = await fetchJsonTry(ENDPOINTS.me, {
        method: "GET",
        headers: headersWithIds(uid, acc, key),
      });

      if (!res.ok) return;
      applyMe(data as MeResp);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const u = (safeGet(UI_LANG_KEY).trim() as UiLang) || "de";
    const o = (safeGet(OUT_LANG_KEY).trim() as OutLang) || "de";
    if (u === "de" || u === "en") setUiLang(u);
    if (o === "de" || o === "en") setOutLang(o);

    const p = safeGet(PLAN_STORAGE_KEY).trim() as Plan;
    if (p === "FREE" || p === "PRO") setPlan(p);

    const k = safeGet(APIKEY_STORAGE_KEY).trim();
    if (k) setApiKey(k);

    const ls = safeGet(LAST_SESSION_ID_KEY).trim();
    if (ls) setLastSessionId(ls);

    // NEW: restore dropdown selections
    const ucKey = safeGet(USECASE_KEY_KEY).trim();
    const ucCustom = safeGet(USECASE_CUSTOM_KEY);
    const tKey = safeGet(TONE_KEY_KEY).trim();
    const tCustom = safeGet(TONE_CUSTOM_KEY);

    if (ucKey) setUseCaseKey(ucKey);
    if (ucCustom) setUseCaseCustom(ucCustom);
    if (tKey) setToneKey(tKey);
    if (tCustom) setToneCustom(tCustom);

    try {
      const raw = safeGet(HISTORY_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
      if (Array.isArray(parsed)) setHistory(parsed.slice(0, MAX_HISTORY));
    } catch {}

    ensureIds();
    loadHealth();
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => safeSet(UI_LANG_KEY, uiLang), [uiLang]);
  useEffect(() => safeSet(OUT_LANG_KEY, outLang), [outLang]);
  useEffect(() => safeSet(APIKEY_STORAGE_KEY, apiKey.trim()), [apiKey]);

  // persist dropdowns
  useEffect(() => safeSet(USECASE_KEY_KEY, useCaseKey), [useCaseKey]);
  useEffect(() => safeSet(USECASE_CUSTOM_KEY, useCaseCustom), [useCaseCustom]);
  useEffect(() => safeSet(TONE_KEY_KEY, toneKey), [toneKey]);
  useEffect(() => safeSet(TONE_CUSTOM_KEY, toneCustom), [toneCustom]);

  function pushHistory(entry: HistoryEntry) {
    const next = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(next);
    safeSet(HISTORY_STORAGE_KEY, JSON.stringify(next));
  }

  function clearHistory() {
    setHistory([]);
    safeRemove(HISTORY_STORAGE_KEY);
  }

  async function testKey() {
    setKeyStatus("idle");
    setKeyMsg("");
    const key = apiKey.trim();
    if (!key) {
      setKeyStatus("bad");
      setKeyMsg(t.noKeySet);
      return;
    }

    try {
      const { uid, acc } = ensureIds();
      const { res, data } = await fetchJsonTry(ENDPOINTS.testKey, {
        method: "POST",
        headers: headersWithIds(uid, acc, key),
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        setKeyStatus("bad");
        setKeyMsg(String((data as any)?.error || `HTTP ${res.status}`));
        return;
      }

      setKeyStatus("ok");
      setKeyMsg("OK");
    } catch (e: any) {
      setKeyStatus("bad");
      setKeyMsg(String(e?.message || "error"));
    }
  }

  async function openCheckout() {
    setError("");
    const { uid, acc } = ensureIds();

    try {
      const { res, data } = await fetchJsonTry(ENDPOINTS.checkout, {
        method: "POST",
        headers: headersWithIds(uid, acc, apiKey.trim()),
        body: JSON.stringify({ userId: uid, accountId: acc }),
      });

      const url = String((data as any)?.url || "");
      const sessionId = String((data as any)?.sessionId || "");

      if (!res.ok || !url) {
        throw new Error(
          String((data as any)?.error || `checkout_${res.status}`)
        );
      }

      if (sessionId) {
        safeSet(LAST_SESSION_ID_KEY, sessionId);
        setLastSessionId(sessionId);
      }

      window.location.href = url;
    } catch (e: any) {
      setError(String(e?.message || "checkout_failed"));
    }
  }

  async function openBillingPortal() {
    setError("");

    const { uid, acc } = readIds();
    if (!uid || !acc) {
      setShowMissingIdsModal(true);
      return;
    }

    const body = JSON.stringify({ userId: uid, accountId: acc });
    const hdrs = headersWithIds(uid, acc, apiKey.trim());

    try {
      let { res, data } = await fetchJsonTry(ENDPOINTS.billingPortal, {
        method: "POST",
        headers: hdrs,
        body,
      });

      if (res.status === 404) {
        showToast(`${t.portalError}: 404 → fallback`);
        ({ res, data } = await fetchJsonTry(ENDPOINTS.billingPortalFallback, {
          method: "POST",
          headers: hdrs,
          body,
        }));
      }

      const url = String((data as any)?.url || "");

      if (!res.ok || !url) {
        const err = String((data as any)?.error || `portal_${res.status}`);

        if (err === "missing_customer_id") {
          showToast(t.portalNeedsCustomer);
          setShowRestoreModal(true);
          return;
        }

        showToast(`${t.portalError}: ${err}`);
        return;
      }

      window.location.href = url;
    } catch (e: any) {
      showToast(`${t.portalError}: ${String(e?.message || "unknown_error")}`);
    }
  }

  async function syncCheckout(sessionIdRaw?: string) {
    setError("");

    const sessionId = String(
      sessionIdRaw || restoreSessionId || lastSessionId || ""
    ).trim();
    if (!sessionId) {
      showToast(t.missingSession);
      return;
    }

    const { uid, acc } = ensureIds();

    try {
      const { res, data } = await fetchJsonTry(ENDPOINTS.sync, {
        method: "POST",
        headers: headersWithIds(uid, acc, apiKey.trim()),
        body: JSON.stringify({ sessionId, userId: uid, accountId: acc }),
      });

      if (!res.ok)
        throw new Error(String((data as any)?.error || `sync_${res.status}`));

      safeSet(LAST_SESSION_ID_KEY, sessionId);
      setLastSessionId(sessionId);

      await loadMe();
      showToast(t.synced);
    } catch (e: any) {
      showToast(`Sync error: ${String(e?.message || "unknown_error")}`);
    }
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError("");

    const { uid, acc } = ensureIds();

    const useCase =
      useCaseKey === "custom"
        ? useCaseCustom.trim()
        : optLabel(USE_CASES, useCaseKey, outLang);
    const tone =
      toneKey === "custom"
        ? toneCustom.trim()
        : optLabel(TONES, toneKey, outLang);

    if (useCaseKey === "custom" && !useCase) {
      setError(t.customMissing);
      return;
    }
    if (toneKey === "custom" && !tone) {
      setError(t.customMissing);
      return;
    }

    try {
      setIsGenerating(true);

      const { res, data } = await fetchJsonTry(ENDPOINTS.generate, {
        method: "POST",
        headers: headersWithIds(uid, acc, apiKey.trim()),
        body: JSON.stringify({
          useCase,
          tone,
          topic,
          extra,
          outLang,
          boost,
        }),
      });

      if (!res.ok) {
        const err = String((data as any)?.error || `gen_${res.status}`);
        throw new Error(err);
      }

      const text = String((data as any)?.output || (data as any)?.text || "");
      setOutput(text);

      const newPlan = String((data as any)?.plan || plan) as Plan;
      if (newPlan === "FREE" || newPlan === "PRO") {
        setPlan(newPlan);
        safeSet(PLAN_STORAGE_KEY, newPlan);
      }

      const usageFromGen = (data as any)?.usage;
      if (usageFromGen) setUsed(pickUsed(usageFromGen));

      const limitsFromGen = (data as any)?.limits;
      if (limitsFromGen)
        setLimits(pickLimits(limitsFromGen, limits.free, limits.pro));

      pushHistory({
        id: randomId("h"),
        timestamp: Date.now(),
        useCase,
        tone,
        topic,
        extra,
        outLang,
        boost,
        result: text,
      });
    } catch (e: any) {
      setError(String(e?.message || "generate_failed"));
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output || "");
      showToast(t.copied);
    } catch {
      outputRef.current?.select();
      document.execCommand("copy");
      showToast(t.copied);
    }
  }

  /* =========================
     Styles
  ========================= */

  const card: React.CSSProperties = {
    border: "1px solid #202230",
    borderRadius: 18,
    background: "#0b0d14",
    padding: 14,
  };
  const row: React.CSSProperties = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  };
  const btn: React.CSSProperties = {
    borderRadius: 14,
    border: "1px solid #202230",
    background: "#0f1118",
    color: "#e7e7ff",
    padding: "10px 12px",
    cursor: "pointer",
  };
  const primaryBtn: React.CSSProperties = {
    ...btn,
    border: "1px solid #244d2f",
    background: "rgba(20,83,45,.25)",
    fontWeight: 900,
  };
  const input: React.CSSProperties = {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #202230",
    background: "#0f1118",
    color: "#e7e7ff",
    padding: "10px 12px",
    outline: "none",
  };
  const label: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.85,
    marginBottom: 6,
  };

  function pill(ok: boolean): React.CSSProperties {
    return {
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid #202230",
      background: ok ? "rgba(20,83,45,.18)" : "rgba(185,28,28,.14)",
      fontSize: 12,
      fontWeight: 700,
    };
  }

  function SelectBox({
    value,
    onChange,
    options,
    dataAttr,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: Opt[];
    dataAttr: string;
  }) {
    return (
      <div style={{ position: "relative" }}>
        <select
          data-gle={dataAttr}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...input,
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            paddingRight: 36,
            cursor: "pointer",
          }}
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label[outLang]}
            </option>
          ))}
        </select>
        <span
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            opacity: 0.65,
            fontSize: 14,
          }}
        >
          ▾
        </span>
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050608",
        color: "#e7e7ff",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(980px, 96vw)",
          margin: "0 auto",
          display: "grid",
          gap: 12,
        }}
      >
        {/* Header */}
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>{t.title}</div>
              <div style={{ marginTop: 4, opacity: 0.85, fontSize: 13 }}>
                {t.subtitle}
              </div>
              {!!cancelText && (
                <div style={{ marginTop: 6, opacity: 0.9, fontSize: 12 }}>
                  {cancelText}
                </div>
              )}
            </div>

            <div style={row}>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  border: "1px solid #202230",
                  borderRadius: 999,
                  padding: 4,
                }}
              >
                <button
                  style={{
                    ...btn,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background:
                      uiLang === "de" ? "rgba(20,83,45,.25)" : "#0f1118",
                    fontWeight: uiLang === "de" ? 900 : 600,
                  }}
                  onClick={() => setUiLang("de")}
                  type="button"
                >
                  DE
                </button>
                <button
                  style={{
                    ...btn,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background:
                      uiLang === "en" ? "rgba(20,83,45,.25)" : "#0f1118",
                    fontWeight: uiLang === "en" ? 900 : 600,
                  }}
                  onClick={() => setUiLang("en")}
                  type="button"
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, ...row }}>
            <span style={pill(backendStatus === "ok")}>
              ● {t.backend}:{" "}
              {backendStatus === "ok"
                ? "OK"
                : backendStatus === "down"
                ? "DOWN"
                : "…"}
            </span>
            <span style={pill(true)}>
              ● {t.byok}: {byokOnly ? "BYOK-only" : "BYOK + PRO"}
            </span>
            <span style={pill(true)}>
              ● {t.plan}: {isPro ? t.planPro : t.planFree}{" "}
              {renewText ? `· ${renewText}` : ""}
            </span>
            {!!stripeExtra && (
              <span style={pill(true)}>
                ● {t.stripeLabel}: {stripeExtra}
              </span>
            )}
          </div>

          <div style={{ marginTop: 12, ...row }}>
            <button style={primaryBtn} onClick={openCheckout} type="button">
              {t.checkoutOpen}
            </button>
            <button style={btn} onClick={openBillingPortal} type="button">
              {t.manage}
            </button>
            <button style={btn} onClick={() => syncCheckout()} type="button">
              {t.sync}
            </button>
            <button
              style={btn}
              onClick={() => setShowRestoreModal(true)}
              type="button"
            >
              {t.restore}
            </button>
            {!isPro && (
              <button
                style={btn}
                onClick={() => setShowProModal(true)}
                type="button"
              >
                {t.getPro}
              </button>
            )}
          </div>

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

          {!!toastMsg && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.95 }}>
              {toastMsg}
            </div>
          )}
        </div>

        {/* API Key */}
        <div style={card}>
          <div style={{ fontWeight: 900 }}>{t.apiKeyTitle}</div>
          <div style={{ marginTop: 10 }}>
            <input
              style={input}
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div style={{ marginTop: 10, ...row }}>
            <button
              style={btn}
              onClick={() => setShowKey((s) => !s)}
              type="button"
            >
              {showKey ? t.hide : t.show}
            </button>
            <button style={btn} onClick={testKey} type="button">
              {t.test}
            </button>

            {keyStatus !== "idle" && (
              <span style={pill(keyStatus === "ok")}>
                ● {keyStatus.toUpperCase()} {keyMsg ? `· ${keyMsg}` : ""}
              </span>
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            {byokOnly ? t.keyHintByokOnly : t.keyHintNoKey}
          </div>
        </div>

        {/* Generator */}
        <form style={card} onSubmit={onGenerate}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Generator</div>

          <div
            style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}
          >
            <div>
              <div style={label}>{t.useCase}</div>
              <SelectBox
                value={useCaseKey}
                onChange={setUseCaseKey}
                options={USE_CASES}
                dataAttr="usecase"
              />
              {useCaseKey === "custom" && (
                <div style={{ marginTop: 8 }}>
                  <div style={label}>{t.customUseCase}</div>
                  <input
                    style={input}
                    value={useCaseCustom}
                    onChange={(e) => setUseCaseCustom(e.target.value)}
                    placeholder={
                      uiLang === "de"
                        ? "z.B. Webinar-Skript"
                        : "e.g. webinar script"
                    }
                  />
                </div>
              )}
            </div>

            <div>
              <div style={label}>{t.tone}</div>
              <SelectBox
                value={toneKey}
                onChange={setToneKey}
                options={TONES}
                dataAttr="tone"
              />
              {toneKey === "custom" && (
                <div style={{ marginTop: 8 }}>
                  <div style={label}>{t.customTone}</div>
                  <input
                    style={input}
                    value={toneCustom}
                    onChange={(e) => setToneCustom(e.target.value)}
                    placeholder={
                      uiLang === "de" ? "z.B. frech, edgy" : "e.g. bold, edgy"
                    }
                  />
                </div>
              )}
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={label}>{t.outputLang}</div>
              <div style={{ ...row, gap: 6 }}>
                <button
                  type="button"
                  style={{
                    ...btn,
                    padding: "8px 10px",
                    background:
                      outLang === "de" ? "rgba(20,83,45,.25)" : "#0f1118",
                    fontWeight: outLang === "de" ? 900 : 600,
                  }}
                  onClick={() => setOutLang("de")}
                >
                  DE
                </button>
                <button
                  type="button"
                  style={{
                    ...btn,
                    padding: "8px 10px",
                    background:
                      outLang === "en" ? "rgba(20,83,45,.25)" : "#0f1118",
                    fontWeight: outLang === "en" ? 900 : 600,
                  }}
                  onClick={() => setOutLang("en")}
                >
                  EN
                </button>
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={label}>{t.topic}</div>
              <input
                style={input}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  uiLang === "de"
                    ? "z.B. Produktlaunch, Angebot, Thema…"
                    : "e.g. product launch, offer, topic…"
                }
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={label}>{t.extra}</div>
              <input
                style={input}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder={
                  uiLang === "de"
                    ? "z.B. Zielgruppe, Stil, CTA…"
                    : "e.g. audience, style, CTA…"
                }
              />
            </div>
          </div>

          <div style={{ marginTop: 12, ...row }}>
            <button
              type="button"
              style={{
                ...btn,
                border: boost ? "1px solid #244d2f" : "1px solid #202230",
                background: boost ? "rgba(20,83,45,.22)" : "#0f1118",
                fontWeight: boost ? 900 : 600,
              }}
              onClick={() => setBoost((b) => !b)}
              title={t.boostHint}
            >
              {t.boost}: {boost ? "ON" : "OFF"}
            </button>

            <button type="submit" style={primaryBtn} disabled={isGenerating}>
              {isGenerating ? t.generating : t.generate}
            </button>

            <span style={{ opacity: 0.8, fontSize: 12 }}>
              Model: {boost ? models.boost : isPro ? models.pro : models.byok}
            </span>

            <span style={{ opacity: 0.8, fontSize: 12 }}>
              Usage: {used}/{limit} ({progress}%)
            </span>
          </div>
        </form>

        {/* Output */}
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900 }}>{t.outputTitle}</div>
            <button style={btn} onClick={copyOutput} type="button">
              {t.copy}
            </button>
          </div>

          <textarea
            ref={outputRef}
            style={{
              ...input,
              marginTop: 10,
              minHeight: 160,
              resize: "vertical",
            }}
            value={output}
            readOnly
            placeholder={
              uiLang === "de"
                ? "Hier erscheint dein Output…"
                : "Your output will appear here…"
            }
          />
        </div>

        {/* History */}
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900 }}>{t.historyTitle}</div>
            <button style={btn} onClick={clearHistory} type="button">
              {t.clearHistory}
            </button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {history.length === 0 ? (
              <div style={{ opacity: 0.75, fontSize: 12 }}>
                {uiLang === "de" ? "Noch keine Einträge." : "No entries yet."}
              </div>
            ) : (
              history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    border: "1px solid #202230",
                    borderRadius: 14,
                    padding: 12,
                    background: "#0f1118",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {new Date(h.timestamp).toLocaleString()} · {h.useCase} ·{" "}
                    {h.tone} · {h.outLang.toUpperCase()} · Boost:{" "}
                    {h.boost ? "ON" : "OFF"}
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 900 }}>
                    {h.topic || "(no topic)"}
                  </div>
                  {h.extra ? (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                      {h.extra}
                    </div>
                  ) : null}
                  <div
                    style={{
                      marginTop: 10,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.45,
                    }}
                  >
                    {h.result}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showProModal && (
        <Modal
          title={t.proModalTitle}
          onClose={() => setShowProModal(false)}
          closeLabel={t.close}
        >
          <div
            style={{ whiteSpace: "pre-wrap", opacity: 0.92, lineHeight: 1.5 }}
          >
            {t.proModalText}
          </div>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              style={btn}
              onClick={() => setShowProModal(false)}
              type="button"
            >
              {t.later}
            </button>
            <button style={primaryBtn} onClick={openCheckout} type="button">
              {t.getPro}
            </button>
          </div>
        </Modal>
      )}

      {showRestoreModal && (
        <Modal
          title={t.restoreTitle}
          onClose={() => setShowRestoreModal(false)}
          closeLabel={t.close}
        >
          <div
            style={{ whiteSpace: "pre-wrap", opacity: 0.92, lineHeight: 1.5 }}
          >
            {t.restoreText}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={label}>{t.sessionIdLabel}</div>
            <input
              style={input}
              value={restoreSessionId}
              onChange={(e) => setRestoreSessionId(e.target.value)}
              placeholder="cs_live_... / cs_test_..."
            />
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              style={btn}
              onClick={() => syncCheckout(restoreSessionId)}
              type="button"
            >
              {t.restoreSync}
            </button>
            <button style={primaryBtn} onClick={openCheckout} type="button">
              {t.restoreCheckout}
            </button>
          </div>

          {!!lastSessionId && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              last session_id: {lastSessionId}
            </div>
          )}
        </Modal>
      )}

      {showMissingIdsModal && (
        <Modal
          title={t.missingIdsTitle}
          onClose={() => setShowMissingIdsModal(false)}
          closeLabel={t.close}
        >
          <div
            style={{ whiteSpace: "pre-wrap", opacity: 0.92, lineHeight: 1.5 }}
          >
            {t.missingIdsText}
          </div>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              style={primaryBtn}
              onClick={() => setShowMissingIdsModal(false)}
              type="button"
            >
              {t.ok}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
