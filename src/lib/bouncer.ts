// src/lib/bouncer.ts

// HARD: Formelle Anrede (ohne /g!)
const FORMAL_RE = /\b(?:Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren)\b/;

// HARD: KI-Metasprache & Entschuldigungen
const APOLOGY_RE =
  /(tut mir leid|sorry|ich kann nicht|kann ich nicht|ben[oö]tig|brauche.*info|bitte gib|mehr information|i'm sorry|can't comply|cannot comply|als ki)/i;

const escapeRe = (s: string) =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type Violations = { hard: string[]; soft: string[] };

export function findViolations(
  text: string = "",
  softStems: string[] = [],
): Violations {
  const hard: string[] = [];
  const soft: string[] = [];

  if (FORMAL_RE.test(text)) hard.push("formal_address");
  if (APOLOGY_RE.test(text)) hard.push("apology_or_meta");

  for (const stem of softStems) {
    if (!stem) continue;
    const re = new RegExp(escapeRe(stem), "i");
    if (re.test(text)) soft.push(stem);
  }

  return { hard, soft };
}

export function sanitizeSoftStems(
  text: string = "",
  stems: string[] = [],
): string {
  let out = String(text || "");

  for (const s of stems) {
    if (!s) continue;
    const stem = escapeRe(s);

    // Unicode letters (inkl. ÄÖÜäöüß). "u" + "i" + "g"
    const re = new RegExp(`\\b[\\p{L}]*${stem}[\\p{L}]*\\b`, "giu");
    out = out.replace(re, "");
  }

  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

export function buildRepairPromptHard(
  text: string,
  hardList: string[] = [],
): string {
  const issues = hardList.join(", ");
  return `
Du bist ein erfahrener Redakteur. Korrigiere den folgenden Text strikt.

HARD-RULES:
- Ausschließlich Du-Form (kein "Sie", kein "Ihnen", kein "Ihr/Ihre").
- Keine Entschuldigungen, kein "ich kann nicht", keine Meta-Kommentare.
- Keine Rückfragen nach mehr Informationen.

FORMAT:
- Gib NUR den korrigierten Text aus. Keine Einleitung, keine Erklärungen.

HINWEIS (Probleme gefunden): ${issues}

TEXT:
${text}
`.trim();
}
