"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";

/* =========================
   1) Config
========================= */

// Basis-URL kommt aus .env.local (NEXT_PUBLIC_API_BASE_URL)
// Fallback lokal:
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:3002";

const ENDPOINTS = {
  generate: `${API_BASE_URL}/api/generate`,
  health: `${API_BASE_URL}/api/health`,
  testKey: `${API_BASE_URL}/api/test`,
  checkout: `${API_BASE_URL}/api/create-checkout-session`,
  billingPortal: `${API_BASE_URL}/api/billing-portal`,
  me: `${API_BASE_URL}/api/me`,
};

type BackendStatus = "unknown" | "ok" | "down";
type Plan = "FREE" | "PRO";

type Meta = {
  model?: string;
  tokens?: number;
  boost?: boolean;
  plan?: Plan;
  isBYOK?: boolean;
  requestId?: string;
  openaiRequestId?: string;
};

type HistoryEntry = {
  id: string;
  timestamp: number;
  useCase: string;
  tone: string;
  language: string;
  topic: string;
  extra: string;
  boost: boolean;
  result: string;
  meta?: Meta | null;
};

const HISTORY_STORAGE_KEY = "gle_history_v1";
const APIKEY_STORAGE_KEY = "gle_api_key_v1";
const PLAN_STORAGE_KEY = "gle_plan_v1";
const USERID_STORAGE_KEY = "gle_user_id_v1";
const ME_CACHE_STORAGE_KEY = "gle_me_cache_v1";

const MAX_HISTORY = 10;

const FREE_LIMIT_DEFAULT = 25;
const PRO_LIMIT_DEFAULT = 250;

// DEV Tools nur in Dev anzeigen (Reset Usage, Modal-Button etc.)
const SHOW_DEV_TOOLS = process.env.NODE_ENV !== "production";

/* =========================
   2) Helpers
========================= */

type ApiErrorInfo = {
  error: string;
  status?: number;
  code?: string;
  requestId?: string; // x-gle-request-id
  openaiRequestId?: string; // aus Backend JSON (oder OpenAI Error)
};

function safeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatGermanDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function getNextMonthFirstDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function safePercent(used: number, limit: number) {
  if (!limit || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

function getOrCreateUserId(): string {
  try {
    const existing = localStorage.getItem(USERID_STORAGE_KEY);
    if (existing && existing.trim()) return existing.trim();
    const created = `u_${safeId()}`;
    localStorage.setItem(USERID_STORAGE_KEY, created);
    return created;
  } catch {
    return `u_${safeId()}`;
  }
}

function pickOutput(data: any): string {
  return (data?.result || data?.output || data?.text || data?.output_text || "")
    .toString()
    .trim();
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function parseApiError(res: Response): Promise<ApiErrorInfo> {
  const requestId = res.headers.get("x-gle-request-id") || undefined;

  let payload: any = {};
  try {
    payload = await res.json();
  } catch {}

  return {
    error: payload?.error || `HTTP ${res.status}`,
    status: payload?.status || res.status,
    code: payload?.code || undefined,
    requestId,
    openaiRequestId:
      payload?.openaiRequestId ||
      payload?.openai_request_id ||
      payload?.openaiRequestID ||
      undefined,
  };
}

async function safeCopy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function formatErrorReport(info: ApiErrorInfo, ctx?: Record<string, any>) {
  return [
    `GLE Prompt Studio — Error Report`,
    `Time: ${new Date().toISOString()}`,
    `Message: ${info.error}`,
    info.status ? `Status: ${info.status}` : null,
    info.code ? `Code: ${info.code}` : null,
    info.requestId ? `requestId: ${info.requestId}` : null,
    info.openaiRequestId ? `openaiRequestId: ${info.openaiRequestId}` : null,
    ctx ? `Context: ${JSON.stringify(ctx)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/* =========================
   3) PRO Modal (minimal)
========================= */

function ProModal({
  open,
  onClose,
  onUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "#121218",
          border: "1px solid #202230",
          borderRadius: 16,
          boxShadow: "0 18px 45px rgba(0,0,0,0.6)",
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <div
              style={{
                fontWeight: 900,
                color: "#00e676",
                letterSpacing: "0.04em",
              }}
            >
              GLE PRO
            </div>
            <div style={{ fontSize: 13, color: "#cfd2dc", marginTop: 6 }}>
              PRO = ohne eigenen OpenAI-Key nutzbar + höhere Limits + Boost.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid #333647",
              background: "#050608",
              color: "#cfd2dc",
              cursor: "pointer",
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gap: 8,
            fontSize: 13,
            color: "#cfd2dc",
          }}
        >
          <div>✅ Server-Key (kein BYOK nötig)</div>
          <div>✅ Mehr Prompts / Monat</div>
          <div>✅ Quality Boost (GPT-5)</div>
          <div style={{ opacity: 0.9 }}>
            Nach der Zahlung kommst du automatisch zurück – PRO wird aktiviert.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 16,
          }}
        >
          <button
            onClick={onClose}
            style={{
              borderRadius: 12,
              border: "1px solid #333647",
              background: "#050608",
              color: "#cfd2dc",
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Später
          </button>

          <button
            onClick={onUpgrade}
            style={{
              borderRadius: 12,
              border: "none",
              background:
                "linear-gradient(135deg, #00e676, #00e676 40%, #ff7043)",
              color: "#050608",
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Jetzt PRO holen
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   4) PRO Error Card (Support-Ready)
========================= */

function ApiErrorCard({
  info,
  onClose,
  onCopy,
}: {
  info: ApiErrorInfo;
  onClose: () => void;
  onCopy: () => void;
}) {
  const hasIds = Boolean(info.requestId || info.openaiRequestId);

  return (
    <div
      role="alert"
      style={{
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 16,
        padding: 14,
        marginTop: 12,
        background:
          "linear-gradient(180deg, rgba(255,0,0,0.08), rgba(255,0,0,0.03))",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "rgba(255, 60, 60, 0.95)",
                boxShadow: "0 0 0 4px rgba(255,60,60,0.16)",
                flex: "0 0 auto",
              }}
            />
            <div style={{ fontWeight: 900 }}>Fehler beim Generieren</div>
          </div>

          <div style={{ opacity: 0.93, wordBreak: "break-word" }}>
            {info.error}
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              opacity: 0.92,
              lineHeight: 1.55,
              display: "grid",
              gap: 4,
            }}
          >
            {info.requestId && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <b>requestId:</b>
                <span
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {info.requestId}
                </span>
              </div>
            )}

            {info.openaiRequestId && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <b>openaiRequestId:</b>
                <span
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {info.openaiRequestId}
                </span>
              </div>
            )}

            {(info.status || info.code) && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <b>Status:</b>
                <span>
                  {info.status ?? "-"}
                  {info.code ? ` (${info.code})` : ""}
                </span>
              </div>
            )}

            {!hasIds && (
              <div style={{ opacity: 0.85 }}>
                Tipp: Wenn du im Backend die IDs mitsendest, wird Support
                deutlich schneller.
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flex: "0 0 auto",
          }}
        >
          <button
            type="button"
            onClick={onCopy}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.20)",
              background: "rgba(255,255,255,0.06)",
              cursor: "pointer",
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            Copy Report
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "transparent",
              cursor: "pointer",
              opacity: 0.95,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

/*
WICHTIG:
Den State NICHT hier oben deklarieren (sonst Hook-Error).
➡️ In deiner React-Komponente:
const [apiError, setApiError] = useState<ApiErrorInfo | null>(null);
*/

/* =========================
   4) Page
========================= */

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  // Identity + Plan
  const [userId, setUserId] = useState<string>("");
  const [plan, setPlan] = useState<Plan>("FREE");

  // Backend status
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("unknown");
  const [byokOnly, setByokOnly] = useState(false);

  // Usage (Backend truth)
  const [usageUsed, setUsageUsed] = useState(0);
  const [usageRenewDate, setUsageRenewDate] = useState<Date>(
    getNextMonthFirstDay()
  );

  // API key (BYOK)
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "ok" | "bad">("idle");
  const [keyMsg, setKeyMsg] = useState("");

  // Form
  const [useCase, setUseCase] = useState("Social Media Post");
  const [tone, setTone] = useState("Neutral");
  const [language, setLanguage] = useState("Deutsch");
  const [topic, setTopic] = useState("");
  const [extra, setExtra] = useState("");

  // Boost toggle
  const [boost, setBoost] = useState(false);

  // Result
  const [result, setResult] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1600);
  }

  // Modal
  const [showProModal, setShowProModal] = useState(false);

  // Autosize
  const topicRef = useRef<HTMLTextAreaElement | null>(null);

  const limit = useMemo(
    () => (plan === "PRO" ? PRO_LIMIT_DEFAULT : FREE_LIMIT_DEFAULT),
    [plan]
  );

  const isBYOKActive = Boolean(apiKey.trim());
  const isServerCreditCall = !isBYOKActive && plan === "PRO" && !byokOnly;

  // Quota nur für Server-Credits relevant (BYOK NICHT künstlich limitieren)
  const quotaReached = isServerCreditCall && usageUsed >= limit;

  const pct = safePercent(usageUsed, limit);

  async function refreshMe(uid: string) {
    try {
      const res = await fetch(ENDPOINTS.me, {
        method: "GET",
        headers: { "x-gle-user": uid },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return;

      // Plan server-truth
      if (data.plan === "FREE" || data.plan === "PRO") {
        setPlan(data.plan);
        try {
          localStorage.setItem(PLAN_STORAGE_KEY, data.plan);
        } catch {}
      }

      const used = Number(data?.usage?.used || 0);
      const renewAt = Number(
        data?.usage?.renewAt || getNextMonthFirstDay().getTime()
      );
      setUsageUsed(used);
      setUsageRenewDate(new Date(renewAt));

      setByokOnly(Boolean(data?.byokOnly));

      // Cache
      try {
        localStorage.setItem(ME_CACHE_STORAGE_KEY, JSON.stringify(data));
      } catch {}
    } catch {
      // ignore
    }
  }

  useEffect(() => setMounted(true), []);

  // ✅ INIT: URL cleanup + LocalStorage preload + Backend /api/me
  useEffect(() => {
    if (!mounted) return;

    let alive = true;

    const uid = getOrCreateUserId();
    setUserId(uid);

    // 1) Stripe Return: session_id aus URL entfernen + kurze PRO-Aktivierungsmeldung
    let sawSessionId = false;
    try {
      const url = new URL(window.location.href);
      const sessionId = url.searchParams.get("session_id");
      if (sessionId) {
        sawSessionId = true;
        showToast("Zahlung erkannt ✅ PRO wird aktiviert…");
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      // ignore
    }

    // 2) Local preload: Key / History / (Plan als Fallback)
    try {
      const savedKey = localStorage.getItem(APIKEY_STORAGE_KEY) || "";
      setApiKey(savedKey);
    } catch {}

    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const arr = safeJsonParse<any[]>(raw);
        if (Array.isArray(arr)) setHistory(arr.slice(0, MAX_HISTORY));
      }
    } catch {}

    try {
      const savedPlan = (
        localStorage.getItem(PLAN_STORAGE_KEY) || ""
      ).toUpperCase();
      if (savedPlan === "FREE" || savedPlan === "PRO")
        setPlan(savedPlan as Plan);
    } catch {}

    // Cache (usage/plan) falls Backend down ist
    try {
      const cached = safeJsonParse<any>(
        localStorage.getItem(ME_CACHE_STORAGE_KEY)
      );
      if (cached?.ok) {
        const cachedPlan = String(cached?.plan || "").toUpperCase();
        if (cachedPlan === "FREE" || cachedPlan === "PRO")
          setPlan(cachedPlan as Plan);

        const used = Number(cached?.usage?.used || 0);
        const renewAt = Number(
          cached?.usage?.renewAt || getNextMonthFirstDay().getTime()
        );
        setUsageUsed(used);
        setUsageRenewDate(new Date(renewAt));
        setByokOnly(Boolean(cached?.byokOnly));
      }
    } catch {}

    // 3) Backend truth (/api/me)
    (async () => {
      await refreshMe(uid);
      if (!alive) return;

      // Wenn Stripe-Rückkehr: kurz pollen (Webhook braucht manchmal einen Moment)
      if (sawSessionId) {
        let tries = 0;
        const t = setInterval(async () => {
          tries += 1;
          if (!alive) {
            clearInterval(t);
            return;
          }
          await refreshMe(uid);
          // stop nach ein paar Versuchen (kurz & safe)
          if (tries >= 6) clearInterval(t);
        }, 1500);
      }
    })();

    return () => {
      alive = false;
    };
  }, [mounted]);

  // Persist key
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(APIKEY_STORAGE_KEY, apiKey);
    } catch {}
    setKeyStatus("idle");
    setKeyMsg("");
  }, [apiKey, mounted]);

  // Persist history
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }, [history, mounted]);

  // Backend health ping
  useEffect(() => {
    let alive = true;

    async function ping() {
      try {
        const res = await fetch(ENDPOINTS.health, { method: "GET" });
        const data = await res.json().catch(() => null);
        if (!alive) return;

        setBackendStatus(res.ok ? "ok" : "down");
        setByokOnly(Boolean(data?.byokOnly ?? data?.byok_only ?? false));
      } catch {
        if (!alive) return;
        setBackendStatus("down");
      }
    }

    ping();
    const t = setInterval(ping, 4000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Autosize textarea
  useEffect(() => {
    const el = topicRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(260, Math.max(120, el.scrollHeight))}px`;
  }, [topic]);

  async function handleUpgradeClick() {
    setError("");

    try {
      const uid = userId || getOrCreateUserId();

      const res = await fetch(ENDPOINTS.checkout, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gle-user": uid },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.url) {
        const msg =
          data?.error ||
          data?.message ||
          `Stripe Checkout Fehler (${res.status})`;
        setError(msg);
        showToast(msg);
        setShowProModal(true);
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      const msg = "Checkout nicht erreichbar (Backend down?)";
      setError(msg);
      showToast(msg);
      setShowProModal(true);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      showToast("Kopiert!");
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error(err);
      setError("Konnte den Prompt nicht kopieren.");
    }
  }

  function clearHistory() {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {}
    showToast("Verlauf gelöscht.");
  }

  async function testKey() {
    setError("");
    setKeyMsg("");
    setKeyStatus("idle");

    if (!apiKey.trim()) {
      setKeyStatus("bad");
      setKeyMsg("Kein Key eingetragen.");
      showToast("Kein Key eingetragen.");
      return;
    }

    try {
      const res = await fetch(ENDPOINTS.testKey, {
        method: "GET",
        headers: { "x-openai-key": apiKey.trim() },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error || `Key-Test fehlgeschlagen (${res.status})`;
        setKeyStatus("bad");
        setKeyMsg(msg);
        showToast(msg);
        return;
      }

      setKeyStatus("ok");
      setKeyMsg("Key OK ✅");
      showToast("Key OK ✅");
    } catch {
      setKeyStatus("bad");
      setKeyMsg("Test-Endpoint nicht erreichbar.");
      showToast("Test-Endpoint nicht erreichbar.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setError("");
    setResult("");
    setMeta(null);
    setCopied(false);

    if (!topic.trim()) {
      const msg = "Bitte Thema / Kontext ausfüllen.";
      setError(msg);
      showToast(msg);
      return;
    }

    // BYOK-only: ohne Key geht gar nichts
    if (byokOnly && !apiKey.trim()) {
      const msg = "BYOK-only aktiv ✅ Bitte OpenAI API Key eintragen.";
      setError(msg);
      showToast(msg);
      setShowProModal(true);
      return;
    }

    // Boost: ohne Key nur in PRO sinnvoll (wenn nicht BYOK-only)
    if (boost && !apiKey.trim() && plan !== "PRO") {
      const msg = "Quality Boost ist ein PRO-Feature (ohne eigenen Key).";
      setError(msg);
      showToast(msg);
      setShowProModal(true);
      return;
    }

    if (quotaReached) {
      const isFree = plan !== "PRO"; // FREE = alles was nicht PRO ist

      const msg = !isFree
        ? `Limit erreicht (${limit}/${limit}). Reset am ${formatGermanDate(
            usageRenewDate
          )}.`
        : `Free-Limit erreicht (${limit}/${limit}). Upgrade für mehr.`;

      setError(msg);
      showToast(msg);
      if (isFree) setShowProModal(true);
      return;
    }

    setIsLoading(true);

    try {
      const uid = userId || getOrCreateUserId();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-gle-user": uid,
      };
      if (apiKey.trim()) headers["x-openai-key"] = apiKey.trim();

      const res = await fetch(ENDPOINTS.generate, {
        method: "POST",
        headers,
        body: JSON.stringify({ useCase, tone, language, topic, extra, boost }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          data?.error || data?.message || `Serverfehler (${res.status})`;
        if (res.status === 402 || res.status === 401) setShowProModal(true);
        throw new Error(msg);
      }

      const finalText = pickOutput(data);
      if (!finalText.trim()) throw new Error("Keine Textausgabe erhalten.");

      const tokens =
        Number(data?.meta?.tokens || 0) ||
        Number(data?.tokens || 0) ||
        Number(data?.usage?.total_tokens || 0) ||
        0;

      const backendIsBYOK = Boolean(data?.meta?.isBYOK);

      const m: Meta = {
        model: data?.meta?.model || data?.model || undefined,
        tokens: tokens || undefined,
        boost,
        plan: (data?.meta?.plan as Plan) || plan,
        isBYOK: backendIsBYOK,
      };

      setResult(finalText);
      setMeta(m);
      setBackendStatus("ok");

      const entry: HistoryEntry = {
        id: safeId(),
        timestamp: Date.now(),
        useCase,
        tone,
        language,
        topic,
        extra,
        boost,
        result: finalText,
        meta: m,
      };
      setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));

      // ✅ Usage nur zählen, wenn Server-Credits genutzt wurden
      if (!backendIsBYOK) {
        await refreshMe(uid);
      }

      showToast(boost ? "Prompt erstellt ✅ (BOOST)" : "Prompt erstellt ✅");
    } catch (err: any) {
      const msg = err?.message || "Verbindung zum Backend fehlgeschlagen.";
      console.error(err);
      setError(msg);
      setBackendStatus("down");
      showToast(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const isSubmitDisabled =
    isLoading ||
    !topic.trim() ||
    (byokOnly && !apiKey.trim()) ||
    (boost && !apiKey.trim() && plan !== "PRO") ||
    quotaReached;

  return (
    <main className="gleMain">
      <ProModal
        open={showProModal}
        onClose={() => setShowProModal(false)}
        onUpgrade={handleUpgradeClick}
      />

      <div className="gleGrid">
        {/* Left */}
        <section className="gleCard">
          <header className="gleHeader">
            <div className="gleHeaderRow">
              <div>
                <h1 className="gleTitle">GLE Prompt Studio</h1>
                <p className="gleSub">
                  Master-Prompts für Social Media, Blogartikel, Produkttexte &
                  Newsletter.
                </p>
              </div>

              <div
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                <div
                  className={`gleBadge ${
                    backendStatus === "ok"
                      ? "ok"
                      : backendStatus === "down"
                      ? "down"
                      : ""
                  }`}
                >
                  Backend:{" "}
                  {backendStatus === "ok"
                    ? "verbunden ✅"
                    : backendStatus === "down"
                    ? "nicht erreichbar"
                    : "prüfe..."}
                </div>

                {mounted && backendStatus === "ok" && (
                  <div className={`gleBadge ${byokOnly ? "ok" : ""}`}>
                    BYOK: {byokOnly ? "only ✅" : "fallback erlaubt"}
                  </div>
                )}
              </div>
            </div>

            {/* Usage */}
            <div style={{ marginTop: "0.75rem" }}>
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#cfd2dc" }}>
                    {plan} · {usageUsed} / {limit} Prompts
                    {!isServerCreditCall && (
                      <span style={{ color: "#8a8fa3" }}>
                        {" "}
                        ·{" "}
                        {isBYOKActive
                          ? "BYOK aktiv"
                          : byokOnly
                          ? "BYOK-only"
                          : "FREE/kein Server-Credit"}
                      </span>
                    )}
                  </span>
                  <span style={{ color: "#8a8fa3" }}>
                    Reset am {formatGermanDate(usageRenewDate)}
                  </span>
                </div>

                <div
                  style={{
                    height: 6,
                    background: "#050608",
                    borderRadius: 99,
                    marginTop: 8,
                    overflow: "hidden",
                    border: "1px solid #202230",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: "#00e676",
                      boxShadow: "0 0 10px rgba(0,230,118,0.4)",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {SHOW_DEV_TOOLS && (
                    <button
                      type="button"
                      className="planMiniLink"
                      onClick={() => setShowProModal(true)}
                    >
                      PRO Modal (DEV)
                    </button>
                  )}
                  <button
                    type="button"
                    className="planMiniLink"
                    onClick={handleUpgradeClick}
                  >
                    Checkout öffnen
                  </button>
                  <button
                    type="button"
                    className="planMiniLink"
                    onClick={() => {
                      const uid = userId || getOrCreateUserId();
                      refreshMe(uid);
                      showToast("Status aktualisiert ✅");
                    }}
                  >
                    Sync
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Form */}
          <form onSubmit={handleSubmit} className="gleForm">
            {/* Key */}
            <div>
              <label className="gleLabel">
                OPENAI API KEY (lokal gespeichert)
              </label>

              <div className="keyRow">
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  className="keyInput"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="keyBtn"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
                <button type="button" onClick={testKey} className="keyBtn">
                  Test
                </button>
              </div>

              {(keyStatus !== "idle" || keyMsg) && (
                <div className={`keyHint ${keyStatus === "ok" ? "ok" : "bad"}`}>
                  {keyMsg}
                </div>
              )}

              {!apiKey.trim() && (
                <div className={`keyHint ${byokOnly ? "bad" : "warn"}`}>
                  {byokOnly ? (
                    <>BYOK-only aktiv ✅ Ohne Key geht nichts.</>
                  ) : (
                    <>
                      Hinweis: Kein Key gesetzt. PRO kann trotzdem laufen
                      (Server-Credits), wenn dein Account PRO ist.
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Selects */}
            <div>
              <label className="gleLabel">USE CASE</label>
              <select
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                className="gleSelect"
              >
                <option>Social Media Post</option>
                <option>Blogartikel</option>
                <option>Produktbeschreibung</option>
                <option>E-Mail</option>
              </select>
            </div>

            <div>
              <label className="gleLabel">TON</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="gleSelect"
              >
                <option>Neutral</option>
                <option>Professionell</option>
                <option>Locker</option>
                <option>Motivierend</option>
              </select>
            </div>

            <div>
              <label className="gleLabel">SPRACHE</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="gleSelect"
              >
                <option>Deutsch</option>
                <option>Englisch</option>
              </select>
            </div>

            {/* Topic */}
            <div>
              <label className="gleLabel">THEMA / KONTEXT</label>
              <textarea
                ref={topicRef}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Beschreibe kurz dein Thema..."
                className="gleTextarea"
                style={{ minHeight: "120px" }}
              />
            </div>

            <div>
              <label className="gleLabel">ZUSATZ (OPTIONAL)</label>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder='z.B. "3 Varianten"'
                className="gleTextarea"
                style={{ minHeight: "90px" }}
              />
            </div>

            {/* Boost Toggle */}
            <div className="boostRow">
              <div className="boostLeft">
                <input
                  id="boostToggle"
                  type="checkbox"
                  checked={boost}
                  onChange={(e) => setBoost(e.target.checked)}
                  className="boostCheck"
                />
                <label htmlFor="boostToggle" className="boostLabel">
                  Quality Boost (GPT-5)
                </label>
              </div>
              {boost && <span className="boostPill">Boost aktiv</span>}
            </div>

            {/* Submit */}
            <div>
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="gleSubmit"
              >
                {quotaReached
                  ? `Limit erreicht (${limit}/${limit})`
                  : byokOnly && !apiKey.trim()
                  ? "API Key erforderlich"
                  : isLoading
                  ? "Prompt wird generiert..."
                  : boost
                  ? "Prompt generieren (BOOST)"
                  : "Prompt generieren (mit KI)"}
              </button>

              {error && <div className="gleError">Fehler: {error}</div>}
            </div>
          </form>
        </section>

        {/* Right */}
        <section className="gleCard right">
          <div className="rightHead">
            <div>
              <h2 className="rightTitle">ERGEBNIS</h2>
              <p className="rightSub">
                Kopiere den Prompt direkt in ChatGPT & Co.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!result}
              className={`copyBtn ${result ? "on" : "off"}`}
            >
              {copied ? "Kopiert ✓" : "Kopieren"}
            </button>
          </div>

          {!result && !isLoading && !error && (
            <p className="hintText">
              Noch kein Prompt. Links Thema ausfüllen und generieren.
            </p>
          )}

          <div className="rightBody">
            {isLoading && (
              <p className="loadingText">Dein Prompt wird geschmiedet…</p>
            )}
            {result && <pre className="resultBox">{result}</pre>}
          </div>

          <div className="rightFooter">
            {meta && (meta.model || meta.tokens || meta.boost) && (
              <div className="statsLine">
                {meta.model ? `Model: ${meta.model}` : ""}
                {typeof meta.tokens === "number"
                  ? ` · Tokens: ${meta.tokens}`
                  : ""}
                {meta.boost ? " · BOOST" : ""}
                {typeof meta.isBYOK === "boolean"
                  ? ` · ${meta.isBYOK ? "BYOK" : "Server"}`
                  : ""}
              </div>
            )}
          </div>

          <div className="historyBox">
            <div className="historyHead">
              <h3 className="historyTitle">Verlauf (letzte {MAX_HISTORY})</h3>
              <button
                type="button"
                onClick={clearHistory}
                className="dangerBtn"
              >
                Löschen
              </button>
            </div>

            {history.length === 0 && (
              <p className="historyEmpty">Noch keine Einträge.</p>
            )}

            {history.length > 0 && (
              <div className="historyList">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="historyItem"
                    style={{ cursor: "default" }}
                  >
                    <div className="historyRow">
                      <span className="historyUC">{entry.useCase}</span>
                      <span className="historyTime">
                        {mounted
                          ? new Date(entry.timestamp).toLocaleTimeString(
                              "de-DE",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : ""}
                      </span>
                    </div>
                    <div className="historyTopic">
                      {entry.boost ? "⚡ " : ""}
                      {entry.topic}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {toast && <div className="gleToast">{toast}</div>}

      {/* Global CSS */}
      <style jsx global>{`
        .gleMain {
          min-height: 100vh;
          padding: 2rem;
          background: #050608;
          color: #f5f5f7;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }
        .gleGrid {
          width: 100%;
          max-width: 1100px;
          display: grid;
          gap: 1.5rem;
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 900px) {
          .gleGrid {
            grid-template-columns: 1fr !important;
          }
          .gleMain {
            padding: 1rem;
          }
        }
        .gleCard {
          background: #121218;
          border-radius: 1rem;
          padding: 1.5rem;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.5);
          border: 1px solid #202230;
        }
        .gleCard.right {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .gleHeader {
          margin-bottom: 1.25rem;
        }
        .gleHeaderRow {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
        }
        .gleTitle {
          margin: 0 0 0.35rem 0;
          color: #00e676;
          letter-spacing: 0.04em;
          font-size: 1.4rem;
        }
        .gleSub {
          margin: 0;
          color: #cfd2dc;
          font-size: 0.9rem;
        }
        .gleBadge {
          font-size: 0.75rem;
          padding: 0.25rem 0.6rem;
          border-radius: 999px;
          border: 1px solid #333647;
          background: #111217;
          color: #cfd2dc;
          white-space: nowrap;
        }
        .gleBadge.ok {
          background: #062813;
          color: #7dffaf;
          border-color: #0b3a1e;
        }
        .gleBadge.down {
          background: #2a1113;
          color: #ffb3c0;
          border-color: #4a1a1f;
        }
        .gleForm {
          display: grid;
          gap: 1rem;
        }
        .gleLabel {
          display: block;
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          color: #8a8fa3;
          margin-bottom: 0.35rem;
        }
        .gleSelect,
        .gleTextarea,
        .keyInput {
          width: 100%;
          background: #050608;
          border: 1px solid #333647;
          color: #f5f5f7;
          border-radius: 0.75rem;
          padding: 0.65rem 0.75rem;
          outline: none;
          font-size: 0.95rem;
        }
        .gleTextarea {
          resize: none;
          line-height: 1.35;
        }
        .keyRow {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .keyBtn {
          border-radius: 0.75rem;
          border: 1px solid #333647;
          padding: 0.6rem 0.7rem;
          background: #121218;
          color: #f5f5f7;
          cursor: pointer;
          font-size: 0.85rem;
          white-space: nowrap;
        }
        .keyHint {
          margin-top: 0.5rem;
          padding: 0.6rem 0.75rem;
          border-radius: 0.75rem;
          border: 1px solid #333647;
          background: #0b0c12;
          color: #cfd2dc;
          font-size: 0.9rem;
        }
        .keyHint.ok {
          border-color: #0b3a1e;
          background: #062813;
          color: #7dffaf;
        }
        .keyHint.bad {
          border-color: #ff4b61;
          background: #3b0b10;
          color: #ffd2d5;
        }
        .keyHint.warn {
          border-color: #3a3d52;
          background: #0b0c12;
          color: #b9bdd1;
        }

        /* BOOST UI */
        .boostRow {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 4px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #202230;
          background: #050608;
          flex-wrap: wrap;
        }
        .boostLeft {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .boostCheck {
          width: 18px;
          height: 18px;
        }
        .boostLabel {
          color: #cfd2dc;
          font-size: 13px;
          user-select: none;
        }
        .boostPill {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid #00e676;
          color: #7dffaf;
          background: #062813;
        }

        .gleSubmit {
          margin-top: 0.5rem;
          width: 100%;
          padding: 0.85rem 1rem;
          border-radius: 0.75rem;
          border: none;
          cursor: pointer;
          font-weight: 800;
          background: linear-gradient(135deg, #00e676, #00e676 40%, #ff7043);
          color: #050608;
          opacity: 1;
        }
        .gleSubmit:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .gleError {
          margin-top: 0.6rem;
          padding: 0.75rem;
          border-radius: 0.75rem;
          background: #3b0b10;
          border: 1px solid #ff4b61;
          color: #ffd2d5;
          font-size: 0.9rem;
        }
        .rightHead {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          margin-bottom: 0.75rem;
        }
        .rightTitle {
          margin: 0 0 0.25rem 0;
          font-size: 1.1rem;
        }
        .rightSub {
          margin: 0;
          color: #cfd2dc;
          font-size: 0.9rem;
        }
        .copyBtn {
          border-radius: 999px;
          border: 1px solid #333647;
          padding: 0.45rem 0.9rem;
          font-size: 0.85rem;
          white-space: nowrap;
        }
        .copyBtn.on {
          background: #050608;
          color: #f5f5f7;
          cursor: pointer;
        }
        .copyBtn.off {
          background: #181922;
          color: #7d8195;
          cursor: default;
        }
        .hintText {
          color: #7d8195;
          font-size: 0.9rem;
          margin-bottom: 0.75rem;
        }
        .rightBody {
          flex: 1;
          min-height: 0;
        }
        .loadingText {
          color: #cfd2dc;
          font-size: 0.9rem;
        }
        .resultBox {
          white-space: pre-wrap;
          background: #050608;
          border-radius: 0.75rem;
          border: 1px solid #333647;
          padding: 0.75rem;
          font-size: 0.9rem;
          max-height: 40vh;
          overflow: auto;
        }
        .rightFooter {
          margin-top: 0.75rem;
        }
        .statsLine {
          color: #b9bdd1;
          font-size: 0.85rem;
          padding: 0.5rem 0.25rem 0 0.25rem;
        }
        .historyBox {
          margin-top: 1rem;
          border-top: 1px solid #202230;
          padding-top: 0.75rem;
        }
        .historyHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.4rem;
        }
        .historyTitle {
          margin: 0;
          font-size: 0.95rem;
          color: #e0e3f0;
        }
        .dangerBtn {
          border-radius: 0.75rem;
          border: 1px solid #333647;
          padding: 0.45rem 0.7rem;
          background: #121218;
          color: #ffb3c0;
          cursor: pointer;
          font-size: 0.85rem;
          white-space: nowrap;
        }
        .historyEmpty {
          margin: 0;
          font-size: 0.8rem;
          color: #7d8195;
        }
        .historyList {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          max-height: 30vh;
          overflow: auto;
          margin-top: 0.25rem;
        }
        .historyItem {
          text-align: left;
          border-radius: 0.6rem;
          border: 1px solid #333647;
          padding: 0.45rem 0.6rem;
          background: #050608;
          color: #f5f5f7;
          font-size: 0.8rem;
        }
        .historyRow {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.15rem;
        }
        .historyUC {
          font-weight: 600;
        }
        .historyTime {
          color: #8a8fa3;
        }
        .historyTopic {
          color: #9ca0b4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gleToast {
          position: fixed;
          bottom: 18px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(10, 10, 12, 0.9);
          border: 1px solid #333647;
          color: #f5f5f7;
          padding: 0.6rem 0.9rem;
          border-radius: 999px;
          font-size: 0.9rem;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.5);
          z-index: 50;
        }
        .planMiniLink {
          border: none;
          background: transparent;
          color: #9ca0b4;
          cursor: pointer;
          font-size: 0.8rem;
          text-decoration: underline;
        }
      `}</style>
    </main>
  );
}
