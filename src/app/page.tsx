// src/app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** =========
 * Storage Keys
 * ========= */
const LS = {
  userId: "gle_user_id_v1",
  accountId: "gle_account_id_v1",
  apiKey: "gle_api_key_v1",
  history: "gle_history_v1",
};

type Language = "DE" | "EN";

type HistoryItem = {
  id: string;
  ts: number;
  input: {
    useCase: string;
    tone: string;
    language: Language;
    goal: string;
    context: string;
  };
  output: string;
};

type NetState<T> = {
  loading: boolean;
  status?: number;
  data?: T;
  error?: string;
};

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
  } catch {}
}
function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
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
    return parsed as HistoryItem[];
  } catch {
    return [];
  }
}
function saveHistory(items: HistoryItem[]) {
  try {
    window.localStorage.setItem(LS.history, JSON.stringify(items));
  } catch {}
}
function pickApiBase(): string {
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
) {
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
    return {
      ok: false,
      status: 0,
      data: null,
      error: e?.message || "fetch_failed",
    };
  } finally {
    window.clearTimeout(t);
  }
}

/** =========
 * Minimal UI Components
 * ========= */
function Card(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-base font-semibold text-white">
            {props.title}
          </div>
          {props.subtitle ? (
            <div className="mt-1 text-sm text-white/60">{props.subtitle}</div>
          ) : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className="px-5 py-4">{props.children}</div>
    </div>
  );
}

function Badge(props: {
  variant?: "neutral" | "success" | "warn";
  children: React.ReactNode;
}) {
  const v = props.variant || "neutral";
  const cls =
    v === "success"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : v === "warn"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
      : "border-white/15 bg-white/5 text-white/70";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {props.children}
    </span>
  );
}

function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "ghost";
  title?: string;
}) {
  const v = props.variant || "ghost";
  const cls =
    v === "primary"
      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/20"
      : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10";

  return (
    <button
      type={props.type || "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${cls}`}
    >
      {props.children}
    </button>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-semibold text-white/85">
        {props.label}
      </div>
      <input
        type={props.type || "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-white/25 focus:ring-4 focus:ring-white/10"
      />
    </label>
  );
}

function Textarea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-semibold text-white/85">
        {props.label}
      </div>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={props.rows || 5}
        className="w-full resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-white/25 focus:ring-4 focus:ring-white/10"
      />
    </label>
  );
}

function Modal(props: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b10]/90 backdrop-blur-xl shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-white">
              {props.title}
            </div>
            {props.subtitle ? (
              <div className="mt-1 text-sm text-white/60">{props.subtitle}</div>
            ) : null}
          </div>
          <button
            onClick={props.onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{props.children}</div>
      </div>
    </div>
  );
}

/** =========
 * Page
 * ========= */
export default function Page() {
  const API_BASE = useMemo(() => pickApiBase(), []);
  const toastTimer = useRef<number | null>(null);

  const [toast, setToast] = useState("");

  const [userId, setUserId] = useState("");
  const [accountId, setAccountId] = useState("");

  const [apiKey, setApiKey] = useState("");

  const [useCase, setUseCase] = useState("Marketing");
  const [tone, setTone] = useState("Klar & direkt");
  const [language, setLanguage] = useState<Language>("DE");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");

  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [billingMsg, setBillingMsg] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [me, setMe] = useState<NetState<any>>({ loading: false });
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncSessionId, setSyncSessionId] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  function apiUrl(path: string) {
    if (!path.startsWith("/")) path = `/${path}`;
    return API_BASE ? `${API_BASE}${path}` : path;
  }

  function getHeaders(extra?: Record<string, string>) {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "x-gle-user": userId,
      "x-gle-account-id": accountId,
      ...extra,
    };
    if (apiKey) h["x-gle-api-key"] = apiKey;
    return h;
  }

  function initIds() {
    const existingUser = safeGet(LS.userId);
    const existingAcc = safeGet(LS.accountId);

    const newUser = existingUser || genId("usr");
    const newAcc = existingAcc || genId("acc");

    if (!existingUser) safeSet(LS.userId, newUser);
    if (!existingAcc) safeSet(LS.accountId, newAcc);

    setUserId(newUser);
    setAccountId(newAcc);

    const key = safeGet(LS.apiKey) || "";
    setApiKey(key);

    const hist = loadHistory();
    setHistory(hist);
  }

  useEffect(() => {
    initIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId || !accountId) return;
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

  function resetLocal() {
    safeRemove(LS.userId);
    safeRemove(LS.accountId);
    safeRemove(LS.apiKey);
    safeRemove(LS.history);
    window.location.href = "/";
  }

  async function refreshMe() {
    setMe({ loading: true });
    const res = await fetchJson(apiUrl("/api/me"), {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      setMe({
        loading: false,
        status: res.status,
        error: res.data?.error || res.error || "me_failed",
        data: res.data,
      });
      return;
    }
    setMe({ loading: false, status: res.status, data: res.data });
  }

  const plan: string = (
    me.data?.plan ||
    me.data?.account?.plan ||
    "FREE"
  ).toString();
  const isPro = plan === "PRO" || plan === "ULTIMATE";

  async function onGenerate() {
    setError("");
    setBillingMsg("");

    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setError("Bitte gib kurz dein Ziel/Ergebnis ein.");
      return;
    }

    if (!isPro && !apiKey) {
      setError(
        "Bitte hinterlege deinen OpenAI API Key (BYOK), um im FREE Plan zu generieren."
      );
      return;
    }

    setIsGenerating(true);
    try {
      const body = {
        accountId,
        userId,
        apiKey: apiKey || undefined,
        input: {
          useCase,
          tone,
          language,
          goal: trimmedGoal,
          context: context || "",
        },
      };

      const res = await fetchJson(apiUrl("/api/generate"), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const msg =
          res.status === 429
            ? "Limit erreicht. Bitte später erneut versuchen."
            : res.status === 401
            ? "Nicht autorisiert (API Key prüfen)."
            : res.status === 503
            ? "Service vorübergehend nicht verfügbar."
            : res.data?.error || res.data?.message || `Fehler (${res.status})`;
        setError(String(msg));
        return;
      }

      const out = res.data?.output || res.data?.text || res.data?.result;
      if (!out || typeof out !== "string") {
        setError("Keine Textausgabe erhalten.");
        return;
      }

      setOutput(out);

      const item: HistoryItem = {
        id: genId("h"),
        ts: Date.now(),
        input: {
          useCase,
          tone,
          language,
          goal: trimmedGoal,
          context: context || "",
        },
        output: out,
      };

      const next = [item, ...history].slice(0, 50);
      setHistory(next);
      saveHistory(next);

      showToast("Fertig ✅");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyOutput() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      showToast("Kopiert");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      showToast("Kopieren nicht möglich");
    }
  }

  async function startCheckout() {
    setBillingMsg("");
    const res = await fetchJson(apiUrl("/api/create-checkout-session"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ accountId }),
    });

    if (!res.ok) {
      const msg =
        res.status === 503
          ? "Checkout ist aktuell vorübergehend nicht verfügbar."
          : res.data?.error ||
            res.data?.message ||
            `Checkout Fehler (${res.status})`;
      setBillingMsg(String(msg));
      showToast(String(msg));
      return;
    }

    const url = res.data?.url;
    if (url) window.location.href = url;
    else {
      setBillingMsg("Checkout URL fehlt.");
      showToast("Checkout URL fehlt.");
    }
  }

  async function openBillingPortal() {
    setBillingMsg("");
    const res = await fetchJson(apiUrl("/api/billing-portal"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ accountId }),
    });

    if (!res.ok) {
      const msg =
        res.status === 503
          ? "Abo-Verwaltung ist aktuell vorübergehend nicht verfügbar."
          : res.data?.error ||
            res.data?.message ||
            `Portal Fehler (${res.status})`;
      setBillingMsg(String(msg));
      showToast(String(msg));
      return;
    }

    const url = res.data?.url;
    if (url) window.location.href = url;
    else {
      setBillingMsg("Portal URL fehlt.");
      showToast("Portal URL fehlt.");
    }
  }

  async function runSync() {
    setBillingMsg("");
    const body: any = { accountId };
    if (syncSessionId.trim()) body.sessionId = syncSessionId.trim();

    const res = await fetchJson(apiUrl("/api/sync-checkout-session"), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const msg =
        res.status === 503
          ? "Synchronisierung ist aktuell vorübergehend nicht verfügbar."
          : res.data?.error ||
            res.data?.message ||
            `Sync Fehler (${res.status})`;
      setBillingMsg(String(msg));
      showToast(String(msg));
      return;
    }

    showToast("Synchronisiert ✅");
    setSyncOpen(false);
    setSyncSessionId("");
    await refreshMe();
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-white">
              GLE Prompt Studio
            </div>
            <div className="mt-1 text-sm text-white/60">
              Schnell zu hochwertigen Master-Prompts – ohne Chaos.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={isPro ? "success" : "neutral"}>{plan}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Status */}
          <div className="lg:col-span-1 space-y-4">
            <Card
              title="Status"
              subtitle="Plan, Zugriff & Aktionen"
              right={
                <Button variant="ghost" onClick={refreshMe}>
                  Refresh
                </Button>
              }
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {isPro ? (
                    <Button variant="primary" onClick={openBillingPortal}>
                      Abo verwalten
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={startCheckout}>
                      PRO holen
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    onClick={resetLocal}
                    title="Reset (IDs/API Key/History)"
                  >
                    Reset lokal
                  </Button>

                  {!isPro ? (
                    <button
                      onClick={() => setSyncOpen(true)}
                      className="text-sm font-semibold text-white/85 underline decoration-white/20 underline-offset-4 hover:decoration-white/40"
                      title="Wenn Zahlung erfolgt ist, aber Plan noch FREE"
                    >
                      Schon bezahlt, aber noch FREE? → Abo synchronisieren
                    </button>
                  ) : null}
                </div>

                {billingMsg ? (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                    {billingMsg}
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
                    {error}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white">
                    BYOK API Key
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    Für FREE (BYOK) erforderlich. PRO nutzt Server-Key.
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={apiKey}
                      onChange={(e) => persistApiKey(e.target.value)}
                      placeholder="sk-…"
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-white/25 focus:ring-4 focus:ring-white/10"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => {
                        persistApiKey("");
                        showToast("API Key gelöscht");
                      }}
                      title="API Key löschen"
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Generator + Output */}
          <div className="lg:col-span-2 space-y-4">
            <Card
              title="Generator"
              subtitle="Erzeuge einen Master-Prompt aus wenigen Inputs."
              right={<Badge variant="neutral">{language}</Badge>}
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
                    <div className="mb-1 text-sm font-semibold text-white/85">
                      Use-Case
                    </div>
                    <select
                      value={useCase}
                      onChange={(e) => setUseCase(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25 focus:ring-4 focus:ring-white/10"
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
                    <div className="mb-1 text-sm font-semibold text-white/85">
                      Tonalität
                    </div>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25 focus:ring-4 focus:ring-white/10"
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
                    <div className="mb-1 text-sm font-semibold text-white/85">
                      Sprache
                    </div>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25 focus:ring-4 focus:ring-white/10"
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
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isGenerating}
                  >
                    {isGenerating ? "Generiere…" : "Prompt generieren"}
                  </Button>

                  <Button
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
                  </Button>

                  <div className="ml-auto text-xs text-white/55">
                    Tipp: Kurz + präzise reicht oft.
                  </div>
                </div>
              </form>
            </Card>

            <Card
              title="Output"
              subtitle="Dein Ergebnis + Verlauf (lokal gespeichert)."
              right={
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    disabled={!output}
                    onClick={copyOutput}
                  >
                    {copied ? "✓" : "Copy"}
                  </Button>

                  <Button
                    variant="ghost"
                    disabled={history.length === 0}
                    onClick={() => {
                      setHistory([]);
                      saveHistory([]);
                      showToast("Verlauf gelöscht");
                    }}
                  >
                    Verlauf leeren
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  {output ? (
                    <pre className="max-h-[340px] whitespace-pre-wrap break-words text-sm text-white/90">
                      {output}
                    </pre>
                  ) : (
                    <div className="text-sm text-white/55">
                      Noch kein Output — generiere oben deinen ersten Prompt.
                    </div>
                  )}
                </div>

                {history.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-white">
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
                          className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-white/90">
                              {h.input.useCase} • {h.input.tone}
                            </div>
                            <div className="text-xs text-white/45">
                              {new Date(h.ts).toLocaleString()}
                            </div>
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm text-white/60">
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
        </div>

        {/* Sync Modal */}
        <Modal
          open={syncOpen}
          title="Abo synchronisieren"
          subtitle="Wenn du bezahlt hast, aber der Plan noch FREE ist."
          onClose={() => setSyncOpen(false)}
        >
          <div className="space-y-3">
            <div className="text-sm text-white/60">
              Optional: Falls du eine{" "}
              <span className="font-mono">session_id</span> hast, kannst du sie
              hier einfügen.
            </div>

            <Input
              label="Stripe session_id (optional)"
              value={syncSessionId}
              onChange={setSyncSessionId}
              placeholder="cs_live_… oder cs_test_…"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={runSync}>
                Synchronisieren
              </Button>
              <Button variant="ghost" onClick={() => setSyncOpen(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        </Modal>

        {/* Toast */}
        {toast ? (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur-xl shadow-lg">
              {toast}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
