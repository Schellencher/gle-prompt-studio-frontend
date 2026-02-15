// src/lib/gleCore.ts

/**
 * 1) TYPES & CONSTANTS
 */
export type ApiOk<T extends object = {}> = { ok: true } & T;
export type ApiErr = {
  ok: false;
  error: string;
  message?: string;
  status?: number;
  hard?: string[];
  hard_violations?: string[];
  banned?: string[];
  [k: string]: any;
};
export type ApiResponse<T extends object = {}> = ApiOk<T> | ApiErr;

export const ACCOUNTID_KEY = "gle_account_id";
export const USERID_KEY = "gle_user_id";

const trimSlash = (s: string) => String(s || "").replace(/\/+$/, "");
export const API_BASE = trimSlash(process.env.NEXT_PUBLIC_API_BASE || "");

/**
 * 2) IDENTITY & HEADERS (SSR-safe)
 */
function generateSafeId(prefix: string): string {
  const g = globalThis as any;
  const uuid = g?.crypto?.randomUUID
    ? g.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${String(uuid)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 48)}`;
}

export function getOrCreateId(key: string, prefix: string): string {
  if (typeof window === "undefined") return `${prefix}_ssr`;
  try {
    const existing = localStorage.getItem(key);
    if (existing && existing.trim()) return existing.trim();
    const created = generateSafeId(prefix);
    localStorage.setItem(key, created);
    return created;
  } catch {
    return `${prefix}_fallback`;
  }
}

export const getAccountId = () => getOrCreateId(ACCOUNTID_KEY, "acc");
export const getUserId = () => getOrCreateId(USERID_KEY, "u");

export function buildIdentityHeaders(extra: Record<string, string> = {}) {
  // extra kommt am Ende -> überschreibt falls du IDs manuell setzen willst
  return {
    "x-gle-account-id": getAccountId(),
    "x-gle-user-id": getUserId(),
    ...extra,
  };
}

/**
 * 3) API URL (verhindert /api/api)
 */
export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) return p;

  const base = API_BASE;

  // Wenn base schon auf .../api zeigt und path auch /api/... ist -> doppelt entfernen
  if (base.endsWith("/api") && p.startsWith("/api/")) {
    return `${base}${p.slice(4)}`; // remove leading "/api"
  }

  return `${base}${p}`;
}

/**
 * 4) API CLIENT
 */
async function handleResponse<T extends object>(
  res: Response,
): Promise<ApiResponse<T>> {
  const text = await res.text();
  let data: any = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: "invalid_json",
        message: text,
        status: res.status,
      };
    }
  }

  // Backend liefert schon {ok:true/false}
  if (data && typeof data === "object" && "ok" in data)
    return data as ApiResponse<T>;

  // Normalisieren
  if (res.ok) return { ok: true, ...(data || {}) } as ApiOk<T>;

  return {
    ok: false,
    error: data?.error || "http_error",
    message: data?.message || res.statusText,
    status: res.status,
    ...(data || {}),
  } as ApiErr;
}

export async function apiGet<T extends object>(
  path: string,
  headers: Record<string, string> = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(apiUrl(path), {
    method: "GET",
    headers,
    cache: "no-store",
  });
  return handleResponse<T>(res);
}

export async function apiPost<T extends object>(
  path: string,
  body: any,
  headers: Record<string, string> = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  return handleResponse<T>(res);
}

/**
 * 5) MAPPING (UI -> Backend)
 */
export type GenerateBody = {
  useCase: string;
  tone: string;
  topic: string;
  extra: string;
  outLang: "DE" | "EN";
  boost: boolean;
};

function normLang(v: any): "DE" | "EN" {
  const s = String(v || "DE")
    .trim()
    .toUpperCase();
  if (s === "EN" || s === "ENGLISH" || s === "ENG" || s === "E") return "EN";
  return "DE";
}

export function mapGenerateBody(ui: any) {
  const rawTopic = ui?.goal ?? ui?.topic ?? "";
  const rawExtra = ui?.context ?? ui?.extra ?? "";

  const lang = String(ui?.language ?? ui?.outLang ?? "DE")
    .trim()
    .toUpperCase();

  return {
    useCase: String(ui?.useCase || "").trim() || "Allgemein",
    tone: String(ui?.tone || "").trim() || "Professionell",
    topic: String(rawTopic).trim(),
    extra: String(rawExtra).trim(),
    outLang:
      lang === "EN" || lang === "ENGLISH" || lang === "ENG" ? "EN" : "DE",
    boost: !!ui?.boost,
  };
}
