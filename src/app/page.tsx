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

  // Formular
  const [useCase, setUseCase] = useState("Landingpage / Ad-Copy");
  const [tone, setTone] = useState("Professionell");
  const [goal, setGoal] = useState(
    "GLE Prompt Studio - KI-Tool für Creator & Solopreneure: Social Posts, Ads & Landingpages in Sekunden (Early Access)",
  );
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
            goal:
              "GLE Prompt Studio - AI tool for creators and solopreneurs launching Early Access",
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
            goal:
              "GLE Prompt Studio - KI-Tool für Creator & Solopreneure im Early Access",
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
            goal:
              "GLE Prompt Studio - AI tool for creators and solopreneurs in Early Access",
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
            goal:
              "GLE Prompt Studio - KI-Tool für Creator & Solopreneure im Early Access",
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
            goal:
              "GLE Prompt Studio – email for creators and solopreneurs in Early Access",
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
            goal:
              "GLE Prompt Studio – E-Mail für Creator & Solopreneure im Early Access",
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
            goal:
              "GLE Prompt Studio - product description for creators and solopreneurs",
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
            goal:
              "GLE Prompt Studio - Produktbeschreibung für Creator & Solopreneure",
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
    setGoal(languagePresets[language].goal);
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

    setBusy(true);
    setErr(null);
    setOutput("");

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
      if (res.ok) window.location.href = res.url;
      else setErr(res as AnyErr);
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
      if (res.ok) window.location.href = res.url;
      else setErr(res as AnyErr);
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

  const limit =
    me?.plan === "PRO" ? me?.limits?.PRO_LIMIT : me?.limits?.FREE_LIMIT;

  return (
    <main style={pageWrap}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
        GLE Prompt Studio - Generator
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
          {showDevTools ? "Entwickler-Optionen ausblenden" : "Entwickler-Optionen anzeigen"}
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
        <div style={pill}>
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

        <button onClick={refreshMe} disabled={busy} style={btnSecondary}>
          Aktualisieren
        </button>

        {showDevActions && (
          <>
            <button onClick={resetIds} disabled={busy} style={btnSecondary}>
              Reset IDs
            </button>

            <button onClick={onUpgrade} disabled={busy} style={btnPrimary}>
              Upgrade PRO
            </button>

            <button
              onClick={onBillingPortal}
              disabled={busy}
              style={btnSecondary}
            >
              Billing Portal
            </button>
          </>
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
              setGoal(preset.goal);
              setContext(preset.context);
              setOutput("");
              setErr(null);
            }}
            style={blueSelectStyle}
          >
            <option style={blueOptionStyle} value="Landingpage / Ad-Copy">Landingpage / Ad-Copy</option>
            <option style={blueOptionStyle} value="Social Media Post">Social Media Post</option>
            <option style={blueOptionStyle} value="LinkedIn Post">LinkedIn Post</option>
            <option style={blueOptionStyle} value="Produktbeschreibung">Produktbeschreibung</option>
            <option style={blueOptionStyle} value="E-Mail">E-Mail</option>
            <option style={blueOptionStyle} value="Blogartikel">Blogartikel</option>
            <option style={blueOptionStyle} value="Kurzvideo-Skript">Kurzvideo-Skript</option>
          </select>
        </label>

        <label>
          <div style={labelSmall}>Ton</div>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            style={blueSelectStyle}
          >
            <option style={blueOptionStyle} value="Professionell">Professionell</option>
            <option style={blueOptionStyle} value="Direkt">Direkt</option>
            <option style={blueOptionStyle} value="Locker">Locker</option>
            <option style={blueOptionStyle} value="Verkaufstark">Verkaufstark</option>
            <option style={blueOptionStyle} value="Motivierend">Motivierend</option>
            <option style={blueOptionStyle} value="Neutral">Neutral</option>
          </select>
        </label>

        <label>
          <div style={labelSmall}>Sprache</div>
          <select
            value={language}
            onChange={(e) => {
              const nextLanguage = e.target.value as "de" | "en";
              setLanguage(nextLanguage);
              const preset = getPresetFor(useCase, nextLanguage);
              setGoal(preset.goal);
              setContext(preset.context);
              setOutput("");
              setErr(null);
            }}
            style={inputStyle}
          >
            <option value="de">DE</option>
            <option value="en">EN</option>
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
        <div style={labelSmall}>Thema / Angebot</div>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          style={textareaStyle}
        />
      </label>

      <div style={{ height: 10 }} />

      <label>
        <div style={labelSmall}>Details & gewünschtes Format</div>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={12}
          style={textareaStyle}
        />
      </label>

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
        {activeUseCaseHelp}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button onClick={onGenerate} disabled={busy} style={btnPrimary}>
          {busy ? "..." : uiText.generate}
        </button>

        <button onClick={copyOutput} disabled={!output} style={btnSecondary}>
          {uiText.copy}
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
        <div style={panelStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6, color: "#d00" }}>
            Error
          </div>

          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>
            {err.error ? (
              <>
                <b>{err.error}</b>
                {err.message ? ` - ${err.message}` : ""}
              </>
            ) : (
              "Unbekannter Fehler"
            )}
            {Array.isArray(err.banned) && err.banned.length ? (
              <>
                {" "}
                - banned: <b>{err.banned.join(", ")}</b>
              </>
            ) : null}
            {Array.isArray(err.hard) && err.hard.length ? (
              <>
                {" "}
                - hard: <b>{err.hard.join(", ")}</b>
              </>
            ) : null}
          </div>

          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12 }}>
            {JSON.stringify(err, null, 2)}
          </pre>
        </div>
      )}

      {output && (
        <div style={panelStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            {uiText.result}
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              margin: 0,
              fontSize: 14,
              lineHeight: 1.45,
            }}
          >
            {output}
          </pre>
        </div>
      )}
    </main>
  );
}

/**
 * STYLES
 */
const pageWrap: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 20,
  fontFamily: "system-ui, sans-serif",
};

const labelSmall: React.CSSProperties = { fontSize: 12, opacity: 0.8 };

const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 12,
  marginBottom: 12,
};

const gridConfig: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 120px 120px",
  gap: 12,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  outline: "none",
};

const blueSelectStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#111827",
  color: "#ffffff",
  border: "1px solid #374151",
  boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
  cursor: "pointer",
};

const blueOptionStyle: React.CSSProperties = {
  background: "#111827",
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
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: "#fff",
  color: "#111",
  border: "1px solid #ddd",
};

const pill: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid #eee",
  fontSize: 12,
};

const panelStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  border: "1px solid #e2e2e2",
  borderRadius: 10,
};
