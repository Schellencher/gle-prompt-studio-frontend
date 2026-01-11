// frontend/src/lib/gleUtils.ts

export const USERID_STORAGE_KEY = "gle_user_id";
export const ACCOUNTID_STORAGE_KEY = "gle_account_id";

export function formatGermanDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function getNextMonthFirstDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

export function safePercent(used: number, limit: number): number {
  if (!Number.isFinite(used)) used = 0;
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

export function safeId(): string {
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

export function getOrCreateUserId(): string {
  if (typeof window === "undefined") return `u_${safeId()}`;

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

export function getOrCreateAccountId(): string {
  if (typeof window === "undefined") return `acc_${safeId()}`;

  try {
    const existing = localStorage.getItem(ACCOUNTID_STORAGE_KEY);
    if (existing && existing.trim()) return existing.trim();

    const created = `acc_${safeId()}`;
    localStorage.setItem(ACCOUNTID_STORAGE_KEY, created);
    return created;
  } catch {
    return `acc_${safeId()}`;
  }
}
