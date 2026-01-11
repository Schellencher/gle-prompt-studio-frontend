"use client";

const KEY = "gle_account_id";

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return `acc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getAccountId(): string {
  if (typeof window === "undefined") return "acc_server";

  const existing = window.localStorage.getItem(KEY);
  if (existing && existing.length > 8) return existing;

  const id = newId();
  window.localStorage.setItem(KEY, id);
  return id;
}

export function resetAccountId(): string {
  if (typeof window === "undefined") return "acc_server";
  const id = newId();
  window.localStorage.setItem(KEY, id);
  return id;
}
