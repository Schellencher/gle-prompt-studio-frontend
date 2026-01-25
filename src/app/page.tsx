// src/app/page.tsx — GLE Prompt Studio (Production UI + Debug nur via Bypass/ ?debug=1)
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Plan = "FREE" | "PRO" | "ULTIMATE" | "UNKNOWN";

type HealthState = {
  ok: boolean;
  status: number | null;
  data?: any;
  error?: string;
};

type MeState = {
  ok: boolean;
  status: number | null;
  data?: any;
  error?: string;
};

type HistoryItem = {
  id: string;
  ts: number;
  input: {
    useCase: string;
    tone: string;
    language: "DE" | "EN";
    goal: string;
    context: string;
  };
  output: string;
};

const LS = {
  userId: "gle_user_id_v1",
  accountId: "gle_account_id_v1",
  bypass: "gle_bypass_active",
  apiKey: "gle_openai_api_key_v1",
  history: "gle_history_v1",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function genId(prefix: string) {
  const a = Date.now().toString(16);
  const b = Math.random().toString(16).slice(2, 10);
  return `${prefix}_${a}${b}`;
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = window.localStorage.getItem(LS.history);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean).slice(0, 50);
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    window.localStorage.setItem(LS.history, JSON.stringify(items.slice(0, 50)));
  } catch {
    // ignore
  }
}

function pickApiBase(): string {
  // Optional: set ONE of these in Vercel if you call your Render backend directly
  // e.g. NEXT_PUBLIC_API_BASE_URL="https://<your-backend>.onrender.com"
  // If empty, we call relative "/api/..." (works if you proxy/route internally).
  const env =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "";
  return (env || "").replace(/\/$/, "");
}

async function fetchJson(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const { timeoutMs = 15000, ...rest } = opts;
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal });
    const status = res.status;
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: res.ok, status, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || "fetch_failed" };
  } finally {
    window.clearTimeout(t);
  }
}

function Badge({
  children,
  variant = "neutral",
  shimmer = false,
}: {
  children: React.ReactNode;
  variant?: "neutral" | "success" | "warn";
  shimmer?: boolean;
}) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border";
  const variants: Record<string, string> = {
    neutral: "border-zinc-200 bg-white text-zinc-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <span
      className={cn(
        base,
        variants[variant],
        shimmer &&
          "relative overflow-hidden border-zinc-200 bg-gradient-to-r from-white via-zinc-50 to-white text-zinc-900"
      )}
    >
      {shimmer && (
        <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      )}
      <span className="relative">{children}</span>
      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </span>
  );
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div>
          <div className="text-base font-semibold text-zinc-900">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-sm text-zinc-500">{subtitle}</div>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="text-base font-semibold text-zinc-900">{title}</div>
          <button
            className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  variant = "ghost",
  title,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "subtle";
  title?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary:
      "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 shadow-sm",
    ghost:
      "bg-white text-zinc-900 hover:bg-zinc-100 border border-zinc-200 shadow-sm",
    subtle: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(base, variants[variant])}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  right,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  right?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-zinc-800">{label}</div>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none",
            "focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100",
            right ? "pr-12" : ""
          )}
        />
        {right ? (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {right}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-zinc-800">{label}</div>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none",
          "focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
        )}
      />
    </label>
  );
}

export default function Page() {
  const API_BASE = useMemo(() => pickApiBase(), []);

  const [userId, setUserId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");

  const [bypassActive, setBypassActive] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const [health, setHealth] = useState<HealthState>({
    ok: false,
    status: null,
  });
  const [me, setMe] = useState<MeState>({ ok: false, status: null });

  const [plan, setPlan] = useState<Plan>("UNKNOWN");
  const [planLabel, setPlanLabel] = useState<string>("Lädt…");

  // BYOK
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  // Generator inputs
  const [useCase, setUseCase] = useState("Marketing");
  const [tone, setTone] = useState("Klar & direkt");
  const [language, setLanguage] = useState<"DE" | "EN">("DE");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");

  // Output
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);

  // Restore modal
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreSessionId, setRestoreSessionId] = useState("");
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string>("");

  // Billing feedback
  const [billingMsg, setBillingMsg] = useState<string>("");

  const toastTimer = useRef<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600) as any;
  }

  function apiUrl(path: string) {
    if (!path.startsWith("/")) path = `/${path}`;
    return API_BASE ? `${API_BASE}${path}` : path;
  }

  function commonHeaders(extra?: Record<string, string>) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(extra || {}),
    };
    if (userId) headers["x-gle-user"] = userId;
    if (accountId) headers["x-gle-account-id"] = accountId;
    return headers;
  }

  async function refreshHealth() {
    const res = await fetchJson(apiUrl("/api/health"), {
      method: "GET",
      headers: commonHeaders(),
    });
    setHealth({
      ok: res.ok,
      status: res.status,
      data: res.data,
      error: res.error,
    });
    return res;
  }

  async function refreshMe() {
    const res = await fetchJson(apiUrl("/api/me"), {
      method: "GET",
      headers: commonHeaders(),
    });

    setMe({ ok: res.ok, status: res.status, data: res.data, error: res.error });

    // plan ableiten (robust)
    const p =
      (res.data?.plan as Plan) ||
      (res.data?.account?.plan as Plan) ||
      (res.data?.subscription?.plan as Plan) ||
      "UNKNOWN";

    const norm: Plan =
      p === "PRO" || p === "ULTIMATE" || p === "FREE" ? p : "UNKNOWN";

    setPlan(norm);

    if (norm === "PRO") setPlanLabel("PRO");
    else if (norm === "ULTIMATE") setPlanLabel("ULTIMATE");
    else if (norm === "FREE") setPlanLabel("FREE (BYOK)");
    else setPlanLabel("Unbekannt");

    return res;
  }

  function initIdsAndFlags() {
    // IDs
    const existingUser = safeGet(LS.userId);
    const existingAcc = safeGet(LS.accountId);

    const newUser = existingUser || genId("usr");
    const newAcc = existingAcc || genId("acc");

    if (!existingUser) safeSet(LS.userId, newUser);
    if (!existingAcc) safeSet(LS.accountId, newAcc);

    setUserId(newUser);
    setAccountId(newAcc);

    // BYOK key
    const key = safeGet(LS.apiKey) || "";
    setApiKey(key);

    // History
    const hist = loadHistory();
    setHistory(hist);

    // Bypass/Debug: set bypass if URL contains ?bypass=TOKEN
    const sp = new URLSearchParams(window.location.search);
    const bypassToken = sp.get("bypass");
    const debugParam = sp.get("debug");

    let bypass = safeGet(LS.bypass) === "1";

    if (bypassToken && bypassToken.length >= 8) {
      // Token nicht dauerhaft in der URL lassen
      safeSet(LS.bypass, "1");
      bypass = true;

      sp.delete("bypass");
      const next = sp.toString();
      const cleanUrl = next ? `/?${next}` : "/";
      window.history.replaceState({}, "", cleanUrl);
    }

    setBypassActive(bypass);

    const dbg = debugParam === "1" || bypass;
    setDebugMode(dbg);
  }

  useEffect(() => {
    initIdsAndFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId || !accountId) return;
    // initial fetch
    refreshHealth();
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, accountId]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  function persistApiKey(key: string) {
    setApiKey(key);
    if (key) safeSet(LS.apiKey, key);
    else safeRemove(LS.apiKey);
  }

  function resetLocal(keepBypass = true) {
    const keep = keepBypass ? safeGet(LS.bypass) : null;

    safeRemove(LS.userId);
    safeRemove(LS.accountId);
    safeRemove(LS.apiKey);
    safeRemove(LS.history);

    if (keepBypass && keep === "1") safeSet(LS.bypass, "1");
    else safeRemove(LS.bypass);

    // reload for clean init
    window.location.href = "/";
  }

  async function onGenerate() {
    setError("");
    setBillingMsg("");

    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setError("Bitte gib kurz dein Ziel/Ergebnis ein.");
      return;
    }

    // BYOK required when FREE
    if (plan === "FREE" || plan === "UNKNOWN") {
      const key = (apiKey || "").trim();
      if (!key) {
        setError(
          "Für FREE brauchst du deinen OpenAI API-Key (nur lokal gespeichert)."
        );
        return;
      }
    }

    setIsGenerating(true);
    try {
      const payload: any = {
        useCase,
        tone,
        language,
        goal: trimmedGoal,
        context: context.trim(),
        // Optional: send key for BYOK (backend can ignore when PRO)
        apiKey: (apiKey || "").trim(),
      };

      const res = await fetchJson(apiUrl("/api/generate"), {
        method: "POST",
        headers: commonHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg =
          res.status === 503
            ? "Der Generator ist vorübergehend nicht verfügbar."
            : res.data?.error || res.data?.message || `Fehler (${res.status})`;
        setError(String(msg));
        return;
      }

      const text =
        res.data?.text ||
        res.data?.output ||
        res.data?.result ||
        res.data?.data?.text ||
        "";

      if (!text || String(text).trim().length === 0) {
        setError("Keine Textausgabe erhalten.");
        return;
      }

      const out = String(text).trim();
      setOutput(out);
      showToast("Prompt erstellt ✅");

      const item: HistoryItem = {
        id: genId("h"),
        ts: Date.now(),
        input: {
          useCase,
          tone,
          language,
          goal: trimmedGoal,
          context: context.trim(),
        },
        output: out,
      };
      const next = [item, ...history];
      setHistory(next);
      saveHistory(next);
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output || "");
      setCopied(true);
      showToast("Kopiert");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      showToast("Kopieren nicht möglich");
    }
  }

  async function startCheckout() {
    setBillingMsg("");
    setError("");

    const res = await fetchJson(apiUrl("/api/create-checkout-session"), {
      method: "POST",
      headers: commonHeaders(),
      body: JSON.stringify({ accountId }),
    });

    if (!res.ok) {
      const msg =
        res.status === 503
          ? "Checkout vorübergehend nicht verfügbar (Wartung aktiv)."
          : res.data?.error ||
            res.data?.message ||
            `Checkout Fehler (${res.status})`;
      setBillingMsg(String(msg));
      return;
    }

    const url =
      res.data?.url || res.data?.checkoutUrl || res.data?.sessionUrl || null;

    if (url) {
      window.location.href = String(url);
      return;
    }

    setBillingMsg(
      "Checkout konnte nicht gestartet werden (keine URL erhalten)."
    );
  }

  async function openBillingPortal() {
    setBillingMsg("");
    setError("");

    const res = await fetchJson(apiUrl("/api/billing-portal"), {
      method: "POST",
      headers: commonHeaders(),
      body: JSON.stringify({ accountId }),
    });

    // alias fallback (falls route anders heißt)
    if (!res.ok && (res.status === 404 || res.data?.error === "not_found")) {
      const res2 = await fetchJson(apiUrl("/api/create-portal-session"), {
        method: "POST",
        headers: commonHeaders(),
        body: JSON.stringify({ accountId }),
      });
      if (!res2.ok) {
        const msg =
          res2.status === 503
            ? "Abo-Verwaltung vorübergehend nicht verfügbar (Wartung aktiv)."
            : res2.data?.error ||
              res2.data?.message ||
              `Portal Fehler (${res2.status})`;
        setBillingMsg(String(msg));
        return;
      }
      const url2 = res2.data?.url || res2.data?.portalUrl;
      if (url2) window.location.href = String(url2);
      else
        setBillingMsg(
          "Portal konnte nicht geöffnet werden (keine URL erhalten)."
        );
      return;
    }

    if (!res.ok) {
      const msg =
        res.status === 503
          ? "Abo-Verwaltung vorübergehend nicht verfügbar (Wartung aktiv)."
          : res.data?.error ||
            res.data?.message ||
            `Portal Fehler (${res.status})`;
      setBillingMsg(String(msg));
      return;
    }

    const url = res.data?.url || res.data?.portalUrl || null;
    if (url) window.location.href = String(url);
    else
      setBillingMsg(
        "Portal konnte nicht geöffnet werden (keine URL erhalten)."
      );
  }

  async function runRestoreSync() {
    setRestoreLoading(true);
    setRestoreMsg("");

    const body: any = { accountId };
    const sid = restoreSessionId.trim();
    if (sid) body.sessionId = sid;

    const res = await fetchJson(apiUrl("/api/sync-checkout-session"), {
      method: "POST",
      headers: commonHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const msg =
        res.status === 503
          ? "Synchronisierung ist während Wartung deaktiviert."
          : res.data?.error ||
            res.data?.message ||
            `Sync Fehler (${res.status})`;
      setRestoreMsg(String(msg));
      setRestoreLoading(false);
      return;
    }

    setRestoreMsg("Synchronisiert ✅");
    await refreshMe();
    setRestoreLoading(false);
    window.setTimeout(() => setRestoreOpen(false), 650);
  }

  const planBadge = useMemo(() => {
    if (plan === "PRO")
      return (
        <Badge variant="neutral" shimmer>
          PRO
        </Badge>
      );
    if (plan === "ULTIMATE")
      return (
        <Badge variant="neutral" shimmer>
          ULTIMATE
        </Badge>
      );
    if (plan === "FREE") return <Badge variant="neutral">FREE</Badge>;
    return <Badge variant="warn">Lädt…</Badge>;
  }, [plan]);

  const onlineHint = useMemo(() => {
    if (health.status === null) return "Status wird geprüft…";
    if (health.ok) return "Backend: Online";
    if (health.status === 0) return "Backend: Nicht erreichbar";
    return `Backend: Fehler (${health.status})`;
  }, [health]);

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-zinc-900">
              GLE Prompt Studio
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              Premium Prompts — schnell, klar, wiederverwendbar.
            </div>
          </div>

          <div className="flex items-center gap-2">
            {toast ? (
              <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm">
                {toast}
              </div>
            ) : null}
          </div>
        </div>

        {billingMsg ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {billingMsg}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Status */}
          <Card
            title="Status"
            subtitle={onlineHint}
            right={
              <div className="flex items-center gap-2">
                {planBadge}
                <SmallButton
                  variant="subtle"
                  title="Neu laden"
                  onClick={() => {
                    refreshHealth();
                    refreshMe();
                    showToast("Aktualisiert");
                  }}
                >
                  ↻
                </SmallButton>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm text-zinc-700">
                  Plan:{" "}
                  <span className="font-semibold text-zinc-900">
                    {planLabel}
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  {plan === "PRO" || plan === "ULTIMATE" ? (
                    <SmallButton variant="ghost" onClick={openBillingPortal}>
                      Abo verwalten
                    </SmallButton>
                  ) : (
                    <SmallButton variant="primary" onClick={startCheckout}>
                      PRO freischalten
                    </SmallButton>
                  )}

                  <SmallButton
                    variant="ghost"
                    title="Lokale Daten löschen (IDs, Key, Verlauf)"
                    onClick={() => resetLocal(true)}
                  >
                    Reset
                  </SmallButton>
                </div>
              </div>

              {/* BYOK only for FREE */}
              {plan !== "PRO" && plan !== "ULTIMATE" ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="mb-2 text-sm font-semibold text-zinc-900">
                    OpenAI API-Key (FREE / BYOK)
                  </div>
                  <div className="mb-3 text-sm text-zinc-600">
                    Dein Key bleibt nur in deinem Browser (LocalStorage).
                  </div>

                  <Input
                    label="API-Key"
                    type={apiKeyVisible ? "text" : "password"}
                    value={apiKey}
                    onChange={persistApiKey}
                    placeholder="sk-…"
                    right={
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                        onClick={() => setApiKeyVisible((v) => !v)}
                        title={apiKeyVisible ? "Verbergen" : "Anzeigen"}
                      >
                        {apiKeyVisible ? "Hide" : "Show"}
                      </button>
                    }
                  />
                </div>
              ) : null}

              {/* Restore link */}
              <div className="text-sm">
                <button
                  className="text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
                  onClick={() => {
                    setRestoreMsg("");
                    setRestoreSessionId("");
                    setRestoreOpen(true);
                  }}
                >
                  Schon bezahlt, aber noch FREE? → Abo synchronisieren
                </button>
              </div>

              {/* Debug hint (hidden unless bypass/debug) */}
              {debugMode ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                  Debug aktiv (nur via Bypass/ ?debug=1)
                </div>
              ) : null}
            </div>
          </Card>

          {/* Generator */}
          <Card
            title="Generator"
            subtitle="Erzeuge einen Master-Prompt aus wenigen Inputs."
            right={
              <div className="flex items-center gap-2">
                <Badge variant="neutral">{language}</Badge>
              </div>
            }
          >
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                onGenerate();
              }}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-zinc-800">
                    Use-Case
                  </div>
                  <select
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
                  >
                    <option>Marketing</option>
                    <option>Copywriting</option>
                    <option>Business</option>
                    <option>Sales</option>
                    <option>Social Media</option>
                    <option>Recruiting</option>
                    <option>Support</option>
                    <option>Allgemein</option>
                  </select>
                </label>

                <label className="block">
                  <div className="mb-1 text-sm font-medium text-zinc-800">
                    Tonalität
                  </div>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
                  >
                    <option>Klar & direkt</option>
                    <option>Freundlich</option>
                    <option>Professionell</option>
                    <option>Premium / High-End</option>
                    <option>Locker</option>
                    <option>Emotional</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-zinc-800">
                    Sprache
                  </div>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
                  >
                    <option value="DE">DE</option>
                    <option value="EN">EN</option>
                  </select>
                </label>

                <Input
                  label="Ziel / Ergebnis"
                  value={goal}
                  onChange={setGoal}
                  placeholder='z.B. "Landingpage-Text für Early Access"'
                />
              </div>

              <Textarea
                label="Kontext (optional)"
                value={context}
                onChange={setContext}
                placeholder="Zielgruppe, Produkt, besondere Regeln, Beispiele, Links…"
                rows={5}
              />

              <div className="flex flex-wrap items-center gap-2">
                <SmallButton
                  type="submit"
                  variant="primary"
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generiere…" : "Prompt generieren"}
                </SmallButton>

                <SmallButton
                  variant="ghost"
                  disabled={isGenerating}
                  onClick={() => {
                    setGoal("");
                    setContext("");
                    setError("");
                    setBillingMsg("");
                  }}
                >
                  Leeren
                </SmallButton>

                <div className="ml-auto text-xs text-zinc-500">
                  Tipp: Kurz + präzise reicht oft.
                </div>
              </div>
            </form>
          </Card>

          {/* Output / History */}
          <Card
            title="Output"
            subtitle="Dein Ergebnis + Verlauf (lokal gespeichert)."
            right={
              <div className="flex items-center gap-2">
                <SmallButton
                  variant="ghost"
                  disabled={!output}
                  onClick={copyOutput}
                  title="In die Zwischenablage"
                >
                  {copied ? "✓" : "Copy"}
                </SmallButton>

                <SmallButton
                  variant="ghost"
                  disabled={history.length === 0}
                  onClick={() => {
                    setHistory([]);
                    saveHistory([]);
                    showToast("Verlauf gelöscht");
                  }}
                  title="Verlauf löschen"
                >
                  Verlauf leeren
                </SmallButton>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                {output ? (
                  <pre className="max-h-[320px] whitespace-pre-wrap break-words text-sm text-zinc-900">
                    {output}
                  </pre>
                ) : (
                  <div className="text-sm text-zinc-500">
                    Noch kein Output — generiere links deinen ersten Prompt.
                  </div>
                )}
              </div>

              {history.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-zinc-900">
                    Verlauf
                  </div>
                  <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                    {history.slice(0, 12).map((h) => (
                      <button
                        key={h.id}
                        onClick={() => {
                          setUseCase(h.input.useCase);
                          setTone(h.input.tone);
                          setLanguage(h.input.language);
                          setGoal(h.input.goal);
                          setContext(h.input.context);
                          setOutput(h.output);
                          showToast("Aus Verlauf geladen");
                        }}
                        className="w-full rounded-2xl border border-zinc-200 bg-white p-3 text-left hover:bg-zinc-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-zinc-900">
                            {h.input.useCase} • {h.input.tone}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {new Date(h.ts).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm text-zinc-600">
                          {h.input.goal}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        {/* Debug (nur via Bypass / debug=1) */}
        {debugMode ? (
          <div className="mt-4">
            <Card
              title="Debug"
              subtitle="Nur sichtbar mit Bypass oder ?debug=1"
              right={
                <div className="flex items-center gap-2">
                  <Badge variant={bypassActive ? "success" : "warn"}>
                    bypass={bypassActive ? "1" : "0"}
                  </Badge>
                  <SmallButton
                    variant="ghost"
                    onClick={() => {
                      // Toggle debug param in URL (optional)
                      const sp = new URLSearchParams(window.location.search);
                      const has = sp.get("debug") === "1";
                      if (has) sp.delete("debug");
                      else sp.set("debug", "1");
                      const qs = sp.toString();
                      window.history.replaceState({}, "", qs ? `/?${qs}` : "/");
                      setDebugMode(!has || bypassActive);
                      showToast("Debug toggled");
                    }}
                  >
                    Toggle ?debug
                  </SmallButton>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-sm font-semibold text-zinc-900">IDs</div>
                  <div className="mt-2 space-y-1 text-xs text-zinc-700">
                    <div>
                      <span className="text-zinc-500">userId:</span>{" "}
                      <span className="font-mono">{userId}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">accountId:</span>{" "}
                      <span className="font-mono">{accountId}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">API base:</span>{" "}
                      <span className="font-mono">
                        {API_BASE ? API_BASE : "(relative /api)"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <SmallButton
                      variant="subtle"
                      onClick={() => {
                        safeRemove(LS.bypass);
                        showToast("Bypass flag gelöscht");
                        setBypassActive(false);
                        // debug bleibt aktiv, solange ?debug=1 gesetzt ist
                        const sp = new URLSearchParams(window.location.search);
                        setDebugMode(sp.get("debug") === "1");
                      }}
                    >
                      Bypass löschen
                    </SmallButton>

                    <SmallButton
                      variant="subtle"
                      onClick={() => resetLocal(false)}
                      title="Komplett zurücksetzen (inkl. Bypass)"
                    >
                      Full Reset
                    </SmallButton>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-sm font-semibold text-zinc-900">
                    Checks
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SmallButton variant="ghost" onClick={refreshHealth}>
                      /api/health
                    </SmallButton>
                    <SmallButton variant="ghost" onClick={refreshMe}>
                      /api/me
                    </SmallButton>
                    <SmallButton
                      variant="ghost"
                      onClick={async () => {
                        const res = await fetchJson(
                          apiUrl("/api/billing-portal"),
                          {
                            method: "POST",
                            headers: commonHeaders(),
                            body: JSON.stringify({ accountId }),
                          }
                        );
                        showToast(`billing-portal: ${res.status}`);
                      }}
                      title="Kann 503 (Wartung) oder 400 (kein Customer) sein."
                    >
                      billing-portal
                    </SmallButton>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-zinc-700">
                      health ({health.status ?? "—"})
                    </div>
                    <pre className="max-h-28 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-800">
                      {JSON.stringify(
                        health.data ?? health.error ?? null,
                        null,
                        2
                      )}
                    </pre>

                    <div className="text-xs font-medium text-zinc-700">
                      me ({me.status ?? "—"})
                    </div>
                    <pre className="max-h-28 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-800">
                      {JSON.stringify(me.data ?? me.error ?? null, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {/* Restore Modal */}
        <Modal
          open={restoreOpen}
          title="Abo synchronisieren"
          onClose={() => setRestoreOpen(false)}
        >
          <div className="space-y-3">
            <div className="text-sm text-zinc-600">
              Wenn du bezahlt hast, aber dein Plan noch auf <b>FREE</b> steht,
              kannst du hier die Synchronisierung anstoßen.
            </div>

            <Input
              label="Stripe Session-ID (optional)"
              value={restoreSessionId}
              onChange={setRestoreSessionId}
              placeholder="cs_… (nur falls vorhanden)"
            />

            {restoreMsg ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
                {restoreMsg}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <SmallButton
                variant="ghost"
                onClick={() => setRestoreOpen(false)}
              >
                Schließen
              </SmallButton>
              <SmallButton
                variant="primary"
                disabled={restoreLoading}
                onClick={runRestoreSync}
              >
                {restoreLoading ? "Synchronisiere…" : "Synchronisieren"}
              </SmallButton>
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
}
