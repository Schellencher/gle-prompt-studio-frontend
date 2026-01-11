// frontend/src/lib/identity.ts
export function getOrCreateId(key: string, prefix: string) {
  if (typeof window === "undefined") return `${prefix}_ssr`;
  const existing = localStorage.getItem(key);
  if (existing && existing.trim()) return existing.trim();

  const id =
    (crypto as any)?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const value = `${prefix}_${id}`;
  localStorage.setItem(key, value);
  return value;
}

export function getAccountId() {
  // stabiler Key für DB
  return getOrCreateId("gle_account_id", "acc");
}

export function getUserId() {
  // nur Anzeige/Debug
  return getOrCreateId("gle_user_id", "u");
}
