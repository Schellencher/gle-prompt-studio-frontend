"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  apiGet,
  apiPost,
  buildIdentityHeaders,
  mapGenerateBody,
} from "@/lib/gleCore";

/**
 * TYPES
 */
type Me = {
  plan: "PRO" | "FREE";
  renewAt: number;
  cancelAt: number;
  usage: { used: number; boostUsed: number; monthKey: string };
  limits: { FREE_LIMIT: number; PRO_LIMIT: number; PRO_BOOST_LIMIT: number };
  stripe: { mode: string; hasCustomerId: boolean; status: string };
};

type GenOk = {
  output: string;
  mode: string;
  model: string;
  plan: "PRO" | "FREE";
  used: number;
  limit: number;
  boostUsed: number;
  boostLimit: number;
  renewAt: number;
  cancelAt: number;
};

type AnyErr = {
  ok?: false;
  error?: string;
  message?: string;
  status?: number;
  hard?: string[];
  hard_violations?: string[];
  banned?: string[];
  [k: string]: any;
};

const LS_ACCOUNT = "gle_account_id";
const LS_USER = "gle_user_id";
const LS_APIKEY = "gle_api_key_v1";

function safeUUID() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    }
  } catch {}

  return Math.random().toString(16).slice(2, 18);
}

/**
 * COMPONENT
 */
export default function Home() {
  // Identität (UI-override, wird auch in localStorage gespiegelt)
  const [accountId, setAccountId] = useState("");
  const [userId, setUserId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showDevTools, setShowDevTools] = useState(false);
  const [showPromptDetails, setShowPromptDetails] = useState(false);

  // Formular
  const [useCase, setUseCase] = useState("Landingpage / Ad-Copy");
  const [tone, setTone] = useState("Professionell");
  const [goal, setGoal] = useState("");
  const [context, setContext] =
    useState(`Schreibe eine typische SaaS-Hero-Sektion + Bulletpoints.
Format exakt so:

1) Headline (max. 9 Wörter)
2) Subheadline (1 Satz)
3) 5 Bulletpoints (kurz, knackig)
4) CTA-Zeile (1 Satz)
5) Mini-FAQ: 3 Fragen + Antworten (je 1 Satz)

Infos, die rein müssen:
- Early Access / Warteliste offen
- Preis später 19,99€/Monat
- Zielgruppe: Creator & Solopreneure
- weniger Zeitverlust, schneller Content, konsistentere Qualität

Qualitätsregeln:
- Die 5 Bulletpoints dürfen nur konkrete Vorteile sein.
- Die CTA "Zur Warteliste" darf nur in Punkt 4 stehen, niemals in den Bulletpoints.
- Jeder Bulletpoint muss ein sauberer vollständiger Satz sein.
- Formuliere sauber auf Deutsch.
- Schreibe "Tool für die Erstellung von Content", nicht "Tool für Erstellung von Content".
- Keine kaputten Satzteile.
- Keine vermischten CTA- und Vorteilssätze.
- Keine Wiederholung derselben Aussage in mehreren Punkten.

Keine Emojis. Kein Meta-Gerede.`);
  const [language, setLanguage] = useState<"de" | "en">("de");
  const [boost, setBoost] = useState(false);

  // App-State
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<AnyErr | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const showDevActions = false;

  const languagePresets: Record<
    "de" | "en",
    { goal: string; context: string }
  > = {
    de: {
      goal: "GLE Prompt Studio - KI-Tool für Creator & Solopreneure: Social Posts, Ads & Landingpages in Sekunden (Early Access)",
      context: `Schreibe eine typische SaaS-Hero-Sektion + Bulletpoints.
Format exakt so:

1) Headline (max. 9 Wörter)
2) Subheadline (1 Satz)
3) 5 Bulletpoints (kurz, knackig)
4) CTA-Zeile (1 Satz)
5) Mini-FAQ: 3 Fragen + Antworten (je 1 Satz)

Infos, die rein müssen:
- Early Access / Warteliste offen
- Preis später 19,99€/Monat
- Zielgruppe: Creator & Solopreneure
- weniger Zeitverlust, schneller Content, konsistentere Qualität

Qualitätsregeln:
- Die 5 Bulletpoints dürfen nur konkrete Vorteile sein.
- Die CTA "Zur Warteliste" darf nur in Punkt 4 stehen, niemals in den Bulletpoints.
- Jeder Bulletpoint muss ein sauberer vollständiger Satz sein.
- Formuliere sauber auf Deutsch.
- Schreibe "Tool für die Erstellung von Content", nicht "Tool für Erstellung von Content".
- Keine kaputten Satzteile.
- Keine vermischten CTA- und Vorteilssätze.
- Keine Wiederholung derselben Aussage in mehreren Punkten.

Keine Emojis. Kein Meta-Gerede.`,
    },
    en: {
      goal: "GLE Prompt Studio - AI tool for creators and solopreneurs: social posts, ads and landing pages in seconds (Early Access)",
      context: `Write a typical SaaS hero section + bullet points.
Use exactly this format:

1) Headline (max. 9 words)
2) Subheadline (1 sentence)
3) 5 bullet points (short and clear)
4) CTA line (1 sentence)
5) Mini FAQ: 3 questions + answers (1 sentence each)

Information that must be included:
- Early Access / waitlist is open
- Future price: 19.99€/month
- Target audience: creators and solopreneurs
- less time wasted, faster content, consistent quality

No emojis. No meta talk.`,
    },
  };

  function getPresetFor(nextUseCase: string, nextLanguage: "de" | "en") {
    if (nextUseCase === "Social Media Post") {
      return nextLanguage === "en"
        ? {
            goal: "GLE Prompt Studio - AI tool for creators and solopreneurs launching Early Access",
            context: `Create a social media post for Instagram or LinkedIn.
Use exactly this format:

1) Hook
2) Short main text
3) 4 bullet points
4) CTA

Information that must be included:
- Early Access / waitlist is open
- Future price: 19.99€/month
- Target audience: creators and solopreneurs
- less time wasted, faster content, consistent quality

No emojis. No meta talk.`,
          }
        : {
            goal: "GLE Prompt Studio - KI-Tool für Creator & Solopreneure im Early Access",
            context: `Erstelle einen Social-Media-Post für Instagram oder LinkedIn.
Format exakt so:

1) Hook
2) kurzer Haupttext
3) 4 Bulletpoints
4) CTA

Infos, die rein müssen:
- Early Access / Warteliste offen
- Preis später 19,99€/Monat
- Zielgruppe: Creator & Solopreneure
- weniger Zeitverlust, schneller Content, konsistente Qualität

Keine Emojis. Kein Meta-Gerede.`,
          };
    }

    if (nextUseCase === "LinkedIn Post") {
      return nextLanguage === "en"
        ? {
            goal: "GLE Prompt Studio - AI tool for creators and solopreneurs in Early Access",
            context: `Create a LinkedIn post.
Use exactly this format:

1) Strong opening sentence
2) Short main text
3) 3 clear bullet points
4) Closing thought
5) CTA

Information that must be included:
- GLE Prompt Studio helps creators and solopreneurs prepare content faster
- It supports social posts, ads and landing pages
- Early Access / waitlist is open
- Future price: 19.99€/month

No emojis. No hashtags. No meta talk.`,
          }
        : {
            goal: "GLE Prompt Studio - KI-Tool für Creator & Solopreneure im Early Access",
            context: `Erstelle einen LinkedIn-Post.
Format exakt so:

1) Starker Einstiegssatz
2) kurzer Haupttext
3) 3 klare Bulletpoints
4) abschließender Gedanke
5) CTA

Infos, die rein müssen:
- GLE Prompt Studio hilft Creatorn und Solopreneuren, Content schneller vorzubereiten
- Es unterstützt Social Posts, Ads und Landingpages
- Early Access / Warteliste offen
- Preis später 19,99€/Monat

Keine Emojis. Keine Hashtags. Kein Meta-Gerede.`,
          };
    }
    if (nextUseCase === "E-Mail") {
      return nextLanguage === "en"
        ? {
            goal: "GLE Prompt Studio – email for creators and solopreneurs in Early Access",
            context: `Create a short marketing email.
Use exactly this format:

1) Subject:
2) Opening sentence:
3) Short main text:
4) Benefits:
- Benefit 1
- Benefit 2
- Benefit 3
5) CTA:
6) Closing sentence:

Information that must be included:
- Early Access / waitlist is open
- Future price: 19.99€/month
- Target audience: creators and solopreneurs
- less time wasted, faster content, consistent quality

Quality rules:
- This must be an email, not a landing page.
- Do not write a FAQ.
- Do not write a headline section.
- Point 4 must only contain three benefit bullet points.
- Do not use numbered subpoints under point 4.
- The CTA may only appear in point 5.
- Do not write "CTA line" in point 4.
- Write clean, complete sentences.

No emojis. No meta talk.`,
          }
        : {
            goal: "GLE Prompt Studio – E-Mail für Creator & Solopreneure im Early Access",
            context: `Erstelle eine kurze Marketing-E-Mail.
Format exakt so:

1) Betreff:
2) Einstiegssatz:
3) Kurzer Haupttext:
4) Vorteile:
- Vorteil 1
- Vorteil 2
- Vorteil 3
5) CTA:
6) Abschlusssatz:

Infos, die rein müssen:
- Early Access / Warteliste offen
- Preis später 19,99€/Monat
- Zielgruppe: Creator & Solopreneure
- weniger Zeitverlust, schneller Content, konsistentere Qualität

Qualitätsregeln:
- Das Ergebnis muss eine E-Mail sein, keine Landingpage.
- Keine FAQ schreiben.
- Keine Hero-Sektion schreiben.
- Punkt 4 darf nur drei Vorteil-Bulletpoints enthalten.
- Unter Punkt 4 keine nummerierten Unterpunkte verwenden.
- Die CTA darf nur in Punkt 5 stehen.
- Schreibe nicht "CTA-Zeile" in Punkt 4.
- Schreibe saubere, vollständige Sätze.
- Keine kaputten Satzteile.

Keine Emojis. Kein Meta-Gerede.`,
          };
    }
    if (nextUseCase === "Produktbeschreibung") {
      return nextLanguage === "en"
        ? {
            goal: "GLE Prompt Studio - product description for creators and solopreneurs",
            context: `Create a product description.
Use exactly this format:

1) Product name
2) Short description
3) 5 benefits
4) Best suited for
5) CTA

Information that must be included:
- GLE Prompt Studio helps creators and solopreneurs prepare content faster
- It supports social posts, ads and landing pages
- Early Access / waitlist is open
- Future price: 19.99€/month

No emojis. No hashtags. No meta talk.`,
          }
        : {
            goal: "GLE Prompt Studio - Produktbeschreibung für Creator & Solopreneure",
            context: `Erstelle eine Produktbeschreibung.
Format exakt so:

1) Produktname
2) Kurzbeschreibung
3) 5 Vorteile
4) Für wen geeignet
5) CTA

Infos, die rein müssen:
- GLE Prompt Studio hilft Creatorn und Solopreneuren, Content schneller vorzubereiten
- Es unterstützt Social Posts, Ads und Landingpages
- Early Access / Warteliste offen
- Preis später 19,99€/Monat

Keine Emojis. Keine Hashtags. Kein Meta-Gerede.`,
          };
    }
    return languagePresets[nextLanguage];
  }
  const useCaseHelp: Record<string, string> = {
    "Landingpage / Ad-Copy": `Was du eintragen solltest:
- Angebot oder Produkt
- Zielgruppe
- wichtigster Nutzen
- Preis oder Early-Access-Hinweis
- gewünschte CTA

Beispiel:
GLE Prompt Studio ist ein Tool für Creator und Solopreneure.
Es erstellt strukturierte Entwürfe für Social Posts, Ads und Landingpages.
Early Access ist geöffnet, Preis später 19,99€/Monat.
CTA: Zur Warteliste.`,

    "Social Media Post": `Was du eintragen solltest:
- Plattform
- Thema
- Zielgruppe
- Kernaussage
- gewünschte Länge oder Stil

Beispiel:
Instagram-Post für GLE Prompt Studio.
Zielgruppe: Creator und Solopreneure.
Aussage: Weniger Zeitverlust bei der Content-Erstellung.
Ton: direkt und motivierend.`,

    "LinkedIn Post": `Was du eintragen solltest:
- Thema
- Zielgruppe
- persönliche Perspektive oder Fachmeinung
- gewünschte Aussage
- CTA oder Diskussionsfrage

Beispiel:
LinkedIn-Post über produktiveres Arbeiten mit KI.
Zielgruppe: Solo-Selbstständige.
Aussage: Gute Prompts sparen Zeit und bringen Struktur.`,

    Produktbeschreibung: `Was du eintragen solltest:
- Produktname
- Zielgruppe
- wichtigste Vorteile
- besondere Eigenschaften
- Preis oder Angebot

Beispiel:
Produktbeschreibung für GLE Prompt Studio.
Zielgruppe: Creator und Solopreneure.
Vorteile: schneller strukturierte Inhalte, klare Formate, weniger Zeitverlust.`,

    "E-Mail": `Was du eintragen solltest:
- Empfänger/Zielgruppe
- Ziel der E-Mail
- Kernaussage
- gewünschte CTA
- Ton

Beispiel:
E-Mail an Interessenten der Warteliste.
Ziel: Early Access erklären.
CTA: Zur Warteliste anmelden.`,

    Blogartikel: `Was du eintragen solltest:
- Thema
- Zielgruppe
- gewünschte Struktur
- Hauptpunkte
- SEO-Keyword falls vorhanden

Beispiel:
Blogartikel über Content-Erstellung mit KI.
Zielgruppe: Solo-Selbstständige.
Hauptpunkte: Zeit sparen, bessere Struktur, wiederholbare Prozesse.`,

    "Kurzvideo-Skript": `Was du eintragen solltest:
- Plattform
- Thema
- Zielgruppe
- Hook-Idee
- gewünschte Länge

Beispiel:
TikTok/Reel über GLE Prompt Studio.
Hook: Du verlierst zu viel Zeit beim Content-Erstellen?
Zielgruppe: Creator und Solopreneure.`,
  };

  const useCaseHelpEn: Record<string, string> = {
    "Landingpage / Ad-Copy": `What you should enter:
- offer or product
- target audience
- main benefit
- price or Early Access note
- desired CTA

Example:
GLE Prompt Studio is a tool for creators and solopreneurs.
It creates structured drafts for social posts, ads and landing pages.
Early Access is open, future price 19.99€/month.
CTA: Join the waitlist.`,

    "Social Media Post": `What you should enter:
- platform
- topic
- target audience
- core message
- desired length or style

Example:
Instagram post for GLE Prompt Studio.
Target audience: creators and solopreneurs.
Message: Spend less time creating content.
Tone: direct and motivating.`,

    "LinkedIn Post": `What you should enter:
- topic
- target audience
- personal perspective or expert opinion
- main message
- CTA or discussion question

Example:
LinkedIn post about working more productively with AI.
Target audience: solo entrepreneurs.
Message: Good prompts save time and create structure.`,

    Produktbeschreibung: `What you should enter:
- product name
- target audience
- key benefits
- special features
- price or offer

Example:
Product description for GLE Prompt Studio.
Target audience: creators and solopreneurs.
Benefits: faster structured content, clear formats, less wasted time.`,

    "E-Mail": `What you should enter:
- recipient or target audience
- goal of the email
- core message
- desired CTA
- tone

Example:
Email to waitlist subscribers.
Goal: explain Early Access.
CTA: Join the waitlist.`,

    Blogartikel: `What you should enter:
- topic
- target audience
- desired structure
- main points
- SEO keyword if available

Example:
Blog article about AI content creation.
Target audience: solo entrepreneurs.
Main points: save time, better structure, repeatable processes.`,

    "Kurzvideo-Skript": `What you should enter:
- platform
- topic
- target audience
- hook idea
- desired length

Example:
TikTok/Reel about GLE Prompt Studio.
Hook: Are you wasting too much time creating content?
Target audience: creators and solopreneurs.`,
  };
  const activeUseCaseHelp =
    (language === "en" ? useCaseHelpEn : useCaseHelp)[useCase] ||
    (language === "en"
      ? "Briefly describe the topic, target audience, desired result and important details."
      : "Beschreibe kurz Thema, Zielgruppe, gewünschtes Ergebnis und wichtige Details.");

  const uiText =
    language === "en"
      ? {
          generate: "Create prompt",
          copy: "Copy output",
          result: "Result",
        }
      : {
          generate: "Prompt erstellen",
          copy: "Ausgabe kopieren",
          result: "Ergebnis",
        };

  useEffect(() => {
    setGoal("");
    setContext(languagePresets[language].context);
  }, [language]);

  // Init: IDs + apiKey aus localStorage
  useEffect(() => {
    try {
      const a = localStorage.getItem(LS_ACCOUNT);
      const u = localStorage.getItem(LS_USER);
      const k = localStorage.getItem(LS_APIKEY);

      // Falls noch nix da ist: initial befüllen
      if (!a) localStorage.setItem(LS_ACCOUNT, `acc_${safeUUID()}`);
      if (!u) localStorage.setItem(LS_USER, `u_${safeUUID()}`);

      setAccountId((a || localStorage.getItem(LS_ACCOUNT) || "").trim());
      setUserId((u || localStorage.getItem(LS_USER) || "").trim());
      setApiKey((k || "").trim());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!busy) {
      setLoadingStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % 4);
    }, 650);

    return () => window.clearInterval(timer);
  }, [busy]);

  // Spiegeln: UI -> localStorage (damit Backend/Headers konstant bleiben)
  useEffect(() => {
    try {
      if (accountId) localStorage.setItem(LS_ACCOUNT, accountId);
      if (userId) localStorage.setItem(LS_USER, userId);
      localStorage.setItem(LS_APIKEY, apiKey || "");
    } catch {
      // ignore
    }
  }, [accountId, userId, apiKey]);

  const [engineLabel, setEngineLabel] = useState("");

  // Headers (override account/user, weil buildIdentityHeaders standardmäßig localStorage liest)
  const headers = useMemo(() => {
    const extra: Record<string, string> = {};
    if (apiKey) extra["x-gle-api-key"] = apiKey;

    // Overrides (wichtig: nur setzen, wenn gefüllt)
    if (accountId) extra["x-gle-account-id"] = accountId;
    if (userId) extra["x-gle-user-id"] = userId;

    return buildIdentityHeaders(extra);
  }, [apiKey, accountId, userId]);

  async function refreshMe() {
    try {
      const res = await apiGet<Me>("/api/me", headers);
      if (res.ok) setMe(res);
      else setMe(null);
    } catch {
      setMe(null);
    }
  }

  useEffect(() => {
    if (!accountId || !userId) return;
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  async function onGenerate() {
    const startedAt = Date.now();

    if (!String(goal || "").trim()) {
      setOutput("");
      setCopied(false);
      setErr({
        ok: false,
        error: "missing_topic",
        message:
          language === "en"
            ? "Please enter a topic or offer first."
            : "Bitte gib zuerst ein Thema oder Angebot ein.",
      });
      return;
    }

    setBusy(true);
    setErr(null);
    setOutput("");
    setCopied(false);

    try {
      const body = mapGenerateBody({
        useCase,
        tone,
        goal,
        context,
        language,
        boost,
      });

      const res = await apiPost<GenOk>("/api/generate", body, headers);

      if (res.ok) {
        setOutput(res.output || "");
        setEngineLabel(String(res.model || "").trim());
        await refreshMe();
      } else {
        setErr(res as AnyErr);
      }
    } catch (e: any) {
      setErr({
        ok: false,
        error: "client_error",
        message: e?.message || String(e),
      });
    } finally {
      const elapsed = Date.now() - startedAt;
      const minVisibleMs = 700;

      if (elapsed < minVisibleMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, minVisibleMs - elapsed),
        );
      }

      setBusy(false);
    }
  }
  async function onUpgrade() {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPost<{ url: string }>(
        "/api/create-checkout-session",
        { accountId, userId },
        headers,
      );
      if (res.ok) {
        window.location.href = res.url;
      } else if ((res as AnyErr).error === "missing_customer_id") {
        setErr({
          ok: false,
          error: "billing_not_available",
          message:
            "Für diesen PRO-Testaccount ist noch kein Stripe-Kundenkonto verknüpft. Das Abo-Portal funktioniert erst nach einem echten Stripe-Checkout.",
        });
      } else {
        setErr(res as AnyErr);
      }
    } catch (e: any) {
      setErr({
        ok: false,
        error: "client_error",
        message: e?.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onBillingPortal() {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiPost<{ url: string }>(
        "/api/billing-portal",
        { accountId, userId },
        headers,
      );

      if (res.ok) {
        window.location.href = res.url;
      } else if ((res as AnyErr).error === "missing_customer_id") {
        setErr({
          ok: false,
          error: "billing_not_available",
          message:
            language === "en"
              ? "The billing portal is not available for this PRO test account yet. It will work after a real Stripe checkout."
              : "Für diesen PRO-Testaccount ist noch kein Stripe-Kundenkonto verknüpft. Das Abo-Portal funktioniert erst nach einem echten Stripe-Checkout.",
        });
      } else {
        setErr(res as AnyErr);
      }
    } catch (e: any) {
      setErr({
        ok: false,
        error: "client_error",
        message: e?.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  function resetIds() {
    const newAcc = `acc_${safeUUID()}`;
    const newUser = `u_${safeUUID()}`;
    setAccountId(newAcc);
    setUserId(newUser);
    setMe(null);
    setOutput("");
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // ignore
    }
  }

  // AUTOPILOT_STRUCTURE_MATRIX_HELPER
  const getAutopilotTemplate = (
    selectedUseCase: string,
    selectedLanguage: "de" | "en",
  ) => {
    const isEn = selectedLanguage === "en";

    if (selectedUseCase === "Landingpage / Ad-Copy") {
      return isEn
        ? `Offer/product: [Your product name]
Target audience: [e.g. creators, coaches, SaaS founders]
Main benefit: [e.g. saves 5 hours per week]
Price/note: [e.g. free beta access / 19.99€/month later]
Desired CTA: [e.g. join the waitlist]

Required output structure:
1) Headline (max. 9 words)
2) Subheadline (1 sentence)
3) 5 short benefit bullets
4) CTA line (1 sentence)
5) Mini FAQ: 3 questions + answers

Quality rules:
- The 5 bullets must only contain concrete benefits.
- The CTA may only appear in point 4, never inside the bullet points.
- Every bullet point must be a clean full sentence.
- Write clearly in English.
- No broken sentence fragments.
- Do not mix CTA sentences with benefit bullets.
- Do not repeat the same idea across multiple points.
- No emojis.
- No meta talk.`
        : `Angebot/Produkt: [Dein Produktname]
Zielgruppe: [z.B. Creator, Coaches, SaaS-Gründer]
Wichtigster Nutzen: [z.B. spart 5 Stunden pro Woche]
Preis/Hinweis: [z.B. kostenlose Beta / später 19,99€/Monat]
Gewünschte CTA: [z.B. Zur Warteliste]

Gewünschte Ausgabe-Struktur:
1) Headline (max. 9 Wörter)
2) Subheadline (1 Satz)
3) 5 kurze Nutzen-Bullets
4) CTA-Zeile (1 Satz)
5) Mini-FAQ: 3 Fragen + Antworten

Qualitätsregeln:
- Die 5 Bulletpoints dürfen nur konkrete Vorteile sein.
- Die CTA darf nur in Punkt 4 stehen, niemals in den Bulletpoints.
- Jeder Bulletpoint muss ein sauberer vollständiger Satz sein.
- Formuliere sauber auf Deutsch.
- Keine kaputten Satzteile.
- Keine vermischten CTA- und Vorteilssätze.
- Keine Wiederholung derselben Aussage in mehreren Punkten.
- Keine Emojis.
- Kein Meta-Gerede.`;
    }

    if (selectedUseCase === "Social Media Post") {
      return isEn
        ? `Topic/offer:
${goal || "[Your topic or offer]"}

Platform: [Instagram / LinkedIn / TikTok]
Target audience: [e.g. creators, solo entrepreneurs, small business owners]
Main message: [What should people remember?]
Desired CTA: [e.g. comment, save, click, join]

Required output structure:
1) Strong hook
2) Short main text
3) 4 clear benefit bullets
4) CTA

Quality rules:
- The post must be specific to the topic/offer above.
- Do not write generic motivational text.
- Every bullet must describe a concrete benefit.
- After the hook, include one short transition sentence before the bullet points.
- The output must clearly contain a hook, short main text, 4 bullet points and a CTA.
- Do not mix CTA and benefits.
- Keep it clear, direct and useful.
- No emojis unless explicitly requested.
- No meta talk.`
        : `Thema/Angebot:
${goal || "[Dein Thema oder Angebot]"}

Plattform: [Instagram / LinkedIn / TikTok]
Zielgruppe: [z.B. Creator, Solo-Selbstständige, kleine Unternehmen]
Kernaussage: [Was soll hängen bleiben?]
Gewünschte CTA: [z.B. kommentieren, speichern, klicken, anmelden]

Gewünschte Ausgabe-Struktur:
1) Starker Hook
2) kurzer Haupttext
3) 4 klare Nutzen-Bulletpoints
4) CTA

Qualitätsregeln:
- Der Post muss konkret zum oben genannten Thema/Angebot passen.
- Kein allgemeiner Motivationsspruch.
- Jeder Bulletpoint muss einen konkreten Nutzen beschreiben.
- Nach dem Hook muss ein kurzer Übergangssatz mit 1 Satz stehen, bevor die Bulletpoints starten.
- Die Ausgabe muss klar aus Hook, kurzem Haupttext, 4 Bulletpoints und CTA bestehen.
- Keine vermischten CTA- und Vorteilssätze.
- Schreibe klar, direkt und nützlich.
- Keine Emojis, außer ausdrücklich gewünscht.
- Kein Meta-Gerede.`;
    }

    if (selectedUseCase === "LinkedIn Post") {
      return isEn
        ? `Topic: [Your topic]
Target audience: [Your audience]
Point of view: [Your opinion or angle]
Practical value: [What should the reader learn?]
Desired CTA: [Question or soft CTA]

Required output structure:
1) Strong opening sentence
2) Short main text
3) 3 clear bullet points
4) Closing thought
5) CTA`
        : `Thema: [Dein Thema]
Zielgruppe: [Deine Zielgruppe]
Standpunkt: [Deine Meinung oder Perspektive]
Praktischer Nutzen: [Was soll der Leser mitnehmen?]
Gewünschte CTA: [Frage oder weiche CTA]

Gewünschte Ausgabe-Struktur:
1) Starker Einstiegssatz
2) kurzer Haupttext
3) 3 klare Bulletpoints
4) abschließender Gedanke
5) CTA`;
    }

    if (selectedUseCase === "E-Mail") {
      return isEn
        ? `Recipient/target audience: [Who receives this email?]
Goal: [Sell, inform, invite, reactivate]
Offer/product: [Your offer]
Main benefit: [Why should they care?]
Desired CTA: [What should they do?]

Required output structure:
1) Subject
2) Opening sentence
3) Short main text
4) 3 benefits
5) CTA
6) Closing sentence`
        : `Empfänger/Zielgruppe: [Wer bekommt diese E-Mail?]
Ziel: [Verkaufen, informieren, einladen, reaktivieren]
Angebot/Produkt: [Dein Angebot]
Wichtigster Nutzen: [Warum ist es relevant?]
Gewünschte CTA: [Was sollen sie tun?]

Gewünschte Ausgabe-Struktur:
1) Betreff
2) Einstiegssatz
3) kurzer Haupttext
4) 3 Vorteile
5) CTA
6) Abschlusssatz`;
    }

    if (selectedUseCase === "Blogartikel") {
      return isEn
        ? `Topic: [Blog topic]
Target audience: [Who should read it?]
Search intent: [What does the reader want to know?]
Main points: [3-5 points]
Desired CTA: [Next step]

Required output structure:
1) SEO title
2) Intro
3) Clear outline with H2/H3 headings
4) Key points per section
5) Conclusion + CTA`
        : `Thema: [Blog-Thema]
Zielgruppe: [Wer soll es lesen?]
Suchintention: [Was will der Leser wissen?]
Hauptpunkte: [3-5 Punkte]
Gewünschte CTA: [Nächster Schritt]

Gewünschte Ausgabe-Struktur:
1) SEO-Titel
2) Einleitung
3) klare Gliederung mit H2/H3
4) Kernpunkte je Abschnitt
5) Fazit + CTA`;
    }

    if (selectedUseCase === "Kurzvideo-Skript") {
      return isEn
        ? `Platform: [TikTok / Reel / Shorts]
Topic: [Your topic]
Target audience: [Who should watch it?]
Hook idea: [First 2 seconds]
Length: [15 / 30 / 45 seconds]
Desired CTA: [Follow, comment, click]

Required output structure:
1) Hook
2) Scene-by-scene script
3) On-screen text
4) Spoken text
5) CTA`
        : `Plattform: [TikTok / Reel / Shorts]
Thema: [Dein Thema]
Zielgruppe: [Wer soll es sehen?]
Hook-Idee: [erste 2 Sekunden]
Länge: [15 / 30 / 45 Sekunden]
Gewünschte CTA: [Folgen, kommentieren, klicken]

Gewünschte Ausgabe-Struktur:
1) Hook
2) Szene-für-Szene-Skript
3) Texteinblendungen
4) Sprechertext
5) CTA`;
    }

    return isEn
      ? `Product name: [Your product name]
Target audience: [Who is it for?]
Main benefit: [Main result or improvement]
Key features: [3-5 features]
Price/offer: [Price, beta, discount or note]
Desired CTA: [Buy, test, join, contact]

Required output structure:
1) Product name
2) Short description
3) 5 benefits
4) Best suited for
5) CTA`
      : `Produktname: [Dein Produktname]
Zielgruppe: [Für wen ist es?]
Wichtigster Nutzen: [Hauptergebnis oder Verbesserung]
Wichtige Eigenschaften: [3-5 Merkmale]
Preis/Angebot: [Preis, Beta, Rabatt oder Hinweis]
Gewünschte CTA: [Kaufen, testen, anmelden, Kontakt]

Gewünschte Ausgabe-Struktur:
1) Produktname
2) Kurzbeschreibung
3) 5 Vorteile
4) Für wen geeignet
5) CTA`;
  };

  const limit =
    me?.plan === "PRO" ? me?.limits?.PRO_LIMIT : me?.limits?.FREE_LIMIT;

  return (
    <main style={pageWrap}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 900,
          marginBottom: 10,
          letterSpacing: "-0.02em",
          color: "#f9fafb",
        }}
      >
        <span
          style={{
            background: "linear-gradient(135deg, #16a34a, #22c55e)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 18px rgba(34, 197, 94, 0.28)",
          }}
        >
          GLE
        </span>{" "}
        Prompt Studio - Generator
      </h1>

      {/* ID SECTION */}
      <div style={{ textAlign: "right", marginBottom: 12 }}>
        <button
          onClick={() => setShowDevTools(!showDevTools)}
          style={{
            background: "transparent",
            border: "none",
            color: "#9ca3af",
            fontSize: 12,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {showDevTools
            ? language === "en"
              ? "Hide developer options"
              : "Entwickler-Optionen ausblenden"
            : language === "en"
              ? "Show developer options"
              : "Entwickler-Optionen anzeigen"}
        </button>
      </div>

      <div style={{ ...grid3, display: showDevTools ? "grid" : "none" }}>
        <label>
          <div style={labelSmall}>Account ID</div>
          <input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            style={inputStyle}
            placeholder="acc_..."
          />
        </label>

        <label>
          <div style={labelSmall}>User ID</div>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={inputStyle}
            placeholder="u_..."
          />
        </label>

        <label>
          <div style={labelSmall}>OpenAI API Key (BYOK optional)</div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={inputStyle}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
          />
        </label>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            ...pill,
            ...(me?.plan === "PRO"
              ? {
                  background: "rgba(22, 163, 74, 0.16)",
                  border: "1px solid rgba(34, 197, 94, 0.55)",
                  color: "#bbf7d0",
                  boxShadow: "0 0 0 1px rgba(34, 197, 94, 0.12)",
                }
              : {}),
          }}
        >
          Plan: <b>{me?.plan ?? "-"}</b> - Used: <b>{me?.usage?.used ?? "-"}</b>{" "}
          / <b>{limit ?? "-"}</b>
          {me?.plan === "PRO" ? (
            <>
              {" "}
              - Boost: <b>{me?.usage?.boostUsed ?? "-"}</b> /{" "}
              <b>{me?.limits?.PRO_BOOST_LIMIT ?? "-"}</b>
            </>
          ) : null}
        </div>
        <button
          onClick={refreshMe}
          disabled={busy}
          style={statusRefreshButtonStyle}
        >
          {language === "en" ? "Refresh" : "Aktualisieren"}
        </button>

        {me?.plan ? (
          me.plan !== "PRO" ? (
            <button onClick={onUpgrade} disabled={busy} style={btnPrimary}>
              Upgrade PRO
            </button>
          ) : (
            <button
              onClick={onBillingPortal}
              disabled={busy}
              style={{
                ...statusRefreshButtonStyle,
                border: "1px solid rgba(34, 197, 94, 0.55)",
                background: "rgba(22, 163, 74, 0.16)",
                color: "#bbf7d0",
              }}
            >
              {language === "en" ? "Manage subscription" : "Abo verwalten"}
            </button>
          )
        ) : null}

        {showDevActions && (
          <button onClick={resetIds} disabled={busy} style={btnSecondary}>
            Reset IDs
          </button>
        )}
      </div>

      {/* CONFIG */}
      <div style={gridConfig}>
        <label>
          <div style={labelSmall}>Use-Case</div>
          <select
            value={useCase}
            onChange={(e) => {
              const nextUseCase = e.target.value;
              const preset = getPresetFor(nextUseCase, language);

              setUseCase(nextUseCase);
              setGoal("");
              setContext(preset.context);
              setOutput("");
              setErr(null);
            }}
            style={blueSelectStyle}
          >
            <option style={blueOptionStyle} value="Landingpage / Ad-Copy">
              Landingpage / Ad-Copy
            </option>
            <option style={blueOptionStyle} value="Social Media Post">
              Social Media Post
            </option>
            <option style={blueOptionStyle} value="LinkedIn Post">
              LinkedIn Post
            </option>
            <option style={blueOptionStyle} value="Produktbeschreibung">
              Produktbeschreibung
            </option>
            <option style={blueOptionStyle} value="E-Mail">
              E-Mail
            </option>
            <option style={blueOptionStyle} value="Blogartikel">
              Blogartikel
            </option>
            <option style={blueOptionStyle} value="Kurzvideo-Skript">
              Kurzvideo-Skript
            </option>
          </select>
        </label>

        <label>
          <div style={labelSmall}>{language === "en" ? "Tone" : "Ton"}</div>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            style={blueSelectStyle}
          >
            <option style={blueOptionStyle} value="Professionell">
              Professionell
            </option>
            <option style={blueOptionStyle} value="Direkt">
              Direkt
            </option>
            <option style={blueOptionStyle} value="Locker">
              Locker
            </option>
            <option style={blueOptionStyle} value="Verkaufstark">
              Verkaufstark
            </option>
            <option style={blueOptionStyle} value="Motivierend">
              Motivierend
            </option>
            <option style={blueOptionStyle} value="Neutral">
              Neutral
            </option>
          </select>
        </label>

        <label>
          <div style={labelSmall}>
            {language === "en" ? "Language" : "Sprache"}
          </div>
          <select
            value={language}
            onChange={(e) => {
              const nextLanguage = e.target.value as "de" | "en";
              setLanguage(nextLanguage);
              const preset = getPresetFor(useCase, nextLanguage);
              setGoal("");
              setContext(preset.context);
              setOutput("");
              setErr(null);
            }}
            style={blueSelectStyle}
          >
            <option style={blueOptionStyle} value="de">
              DE
            </option>
            <option style={blueOptionStyle} value="en">
              EN
            </option>
          </select>
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={boost}
            onChange={(e) => setBoost(e.target.checked)}
          />
          <span style={{ fontSize: 12 }}>Boost</span>
        </label>
      </div>

      <label>
        <div style={labelSmall}>
          {language === "en" ? "Topic / offer" : "Thema / Angebot"}
        </div>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          style={textareaStyle}
        />
      </label>

      <div style={{ height: 10 }} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <div style={labelSmall}>
          {language === "en" ? "Fine tuning" : "Feinsteuerung"}
        </div>
        <button
          type="button"
          onClick={() => setShowPromptDetails(!showPromptDetails)}
          style={{
            background: "transparent",
            border: "none",
            color: "#6b7280",
            fontSize: 12,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {showPromptDetails
            ? language === "en"
              ? "Hide structure matrix"
              : "Struktur-Matrix ausblenden"
            : language === "en"
              ? "Show structure matrix"
              : "Struktur-Matrix anzeigen"}
        </button>
      </div>

      {showPromptDetails && (
        <label>
          <div style={labelSmall}>
            {language === "en"
              ? "⚡ Structure Matrix (PRO Autopilot)"
              : "⚡ Struktur-Matrix (PRO Autopilot)"}
          </div>
          {/* AUTOPILOT_STRUCTURE_MATRIX_BUTTON */}
          <div style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => {
                setContext(getAutopilotTemplate(useCase, language));
              }}
              style={{
                background: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.65)",
                color: "#bbf7d0",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 8px 18px rgba(34, 197, 94, 0.14)",
              }}
            >
              {language === "en"
                ? "✨ Load PRO structure"
                : "✨ PRO-Struktur laden"}
            </button>
          </div>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={10}
            style={textareaStyle}
          />
        </label>
      )}

      <div
        style={{
          marginTop: 10,
          padding: 12,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)",
          color: "#cfd2dc",
          fontSize: 12,
          lineHeight: 1.55,
          whiteSpace: "pre-line",
        }}
      >
        {showPromptDetails
          ? activeUseCaseHelp
          : language === "en"
            ? "Optional: open the structure matrix and load a guided template."
            : "Optional: Struktur-Matrix öffnen und geführte Vorlage laden."}
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 16,
          alignItems: "center",
        }}
      >
        <button onClick={onGenerate} disabled={busy} style={btnPrimary}>
          {busy ? "Prompt wird erstellt..." : uiText.generate}
        </button>

        <button
          onClick={() => {
            copyOutput();
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
          disabled={!output}
          style={btnSecondary}
        >
          {copied ? "KOPIERT!" : uiText.copy}
        </button>
      </div>

      {busy && (
        <div
          ref={loadingRef}
          style={{
            marginTop: 14,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div
            style={{
              marginBottom: 8,
              fontSize: 13,
              color: "#cfd2dc",
              fontWeight: 700,
            }}
          >
            {
              [
                "Analyse läuft",
                "Struktur wird gebaut",
                "Optimierung läuft",
                "Finalisierung",
              ][loadingStep]
            }
          </div>

          <div
            style={{
              height: 8,
              width: "100%",
              overflow: "hidden",
              borderRadius: 999,
              background: "rgba(255,255,255,0.10)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "34%",
                marginLeft: `${loadingStep * 22}%`,
                borderRadius: 999,
                background: "linear-gradient(90deg, #00e676, #57c7e8, #ff7043)",
                transition: "margin-left 620ms ease-in-out",
              }}
            />
          </div>
        </div>
      )}

      {err && (
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>
          <b>
            {err.error === "billing_not_available"
              ? language === "en"
                ? "Notice"
                : "Hinweis"
              : language === "en"
                ? "Error"
                : "Fehler"}
          </b>

          <div style={{ marginTop: 6 }}>
            {(() => {
              const msg = String(err.message || err.error || "");

              if (
                msg.toLowerCase().includes("incorrect api key") ||
                msg.toLowerCase().includes("invalid api key") ||
                msg.toLowerCase().includes("api_key")
              ) {
                return language === "en"
                  ? "The OpenAI API key is invalid. Please check the key or enter a new one."
                  : "Der eingegebene OpenAI API Key ist ungültig. Bitte prüfe den Key oder füge einen neuen ein.";
              }

              return (
                err.message ||
                err.error ||
                (language === "en"
                  ? "Something went wrong."
                  : "Es ist ein Fehler aufgetreten.")
              );
            })()}
          </div>

          {Array.isArray(err.banned) && err.banned.length ? (
            <div style={{ marginTop: 6 }}>
              banned: <b>{err.banned.join(", ")}</b>
            </div>
          ) : null}

          {Array.isArray(err.hard) && err.hard.length ? (
            <div style={{ marginTop: 6 }}>
              hard: <b>{err.hard.join(", ")}</b>
            </div>
          ) : null}

          {showDevActions && (
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 12 }}>
              {JSON.stringify(err, null, 2)}
            </pre>
          )}
        </div>
      )}
      {output && (
        <div style={outputPanelStyle}>
          <div style={outputHeaderStyle}>
            <span>{uiText.result}</span>
            <span style={{ fontSize: 11, opacity: 0.65 }}>Fertig</span>
          </div>
          <pre style={outputPreStyle}>{output}</pre>
        </div>
      )}
      <footer
        style={{
          marginTop: 28,
          paddingTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.12)",
          fontSize: 12,
          opacity: 0.8,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <a href="/impressum">
          {language === "en" ? "Legal notice" : "Impressum"}
        </a>
        <a href="/datenschutz">
          {language === "en" ? "Privacy policy" : "Datenschutz"}
        </a>
        <a href="/support">Support</a>
      </footer>
    </main>
  );
}

// ==========================================
// STYLES (FINALE FEHLERFREIE PREMIUM-VERSION)
// ==========================================

// REPARATUR FEHLER 1: Bringt pageWrap zurück
const pageWrap: React.CSSProperties = {
  width: "min(1120px, calc(100% - 32px))",
  margin: "32px auto",
  padding: "30px",
  backgroundColor: "#0b0c10",
  color: "#f1f1f3",
  borderRadius: "16px",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.7)",
  fontFamily: "system-ui, sans-serif",
};

const labelSmall: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
  marginBottom: 4,
  display: "block",
};

// REPARATUR FEHLER 2: Definiert grid3 für die einklappbaren IDs
const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 12,
};

// REPARATUR FEHLER 3 & 4: Nur noch EINE Zuweisung für gridConfig
const gridConfig: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #2d2d34",
  backgroundColor: "#16161a",
  color: "#ffffff",
  outline: "none",
};

const blueSelectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  backgroundSize: "14px",
  paddingRight: "40px",
  cursor: "pointer",
};

const blueOptionStyle: React.CSSProperties = {
  background: "#16161a",
  color: "#ffffff",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(34, 197, 94, 0.75)",
  background: "linear-gradient(135deg, #16a34a, #22c55e)",
  color: "#052e16",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(34, 197, 94, 0.22)",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #2d2d34",
  background: "#16161a",
  color: "#f1f1f3",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "none",
};

const pill: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid #eee",
  fontSize: 12,
};

const panelStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 16,
  border: "1px solid #1f2026",
  backgroundColor: "#12131a",
  borderRadius: "12px",
};

const statusCardStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 14,
  marginBottom: 18,
  padding: "10px 12px",
  border: "1px solid #1f2026",
  borderRadius: 12,
  background: "#12131a",
};

const statusTextStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.9,
};

const statusRefreshButtonStyle: React.CSSProperties = {
  ...btnSecondary,
  padding: "7px 10px",
  fontSize: 12,
  borderRadius: 10,
};

const outputPanelStyle: React.CSSProperties = {
  ...panelStyle,
  border: "1px solid rgba(0, 230, 118, 0.22)",
  background: "linear-gradient(180deg, #12131a 0%, #0f1117 100%)",
  boxShadow: "0 18px 35px rgba(0, 0, 0, 0.28)",
};

const outputHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontWeight: 800,
  marginBottom: 10,
};

const outputPreStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  color: "#f9fafb",
};
