"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import MagicContextPanel from "@/components/MagicContextPanel";
import ProofStatusBadge, { type ProofResult } from "@/components/ProofStatusBadge";
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

type PromptHistoryItem = {
  id: string;
  createdAt: string;
  useCase: string;
  tone: string;
  topic: string;
  language: string;
  output: string;
};

const PROMPT_HISTORY_KEY = "gle_prompt_history_v1";

function loadPromptHistory(): PromptHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PROMPT_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePromptHistory(items: PromptHistoryItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(items));
  } catch {
    // ignore localStorage errors
  }
}

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
  proof?: ProofResult;
};

type TransformOk = GenOk & {
  transform?: {
    version?: string;
    actionType?: string;
    targetTone?: string | null;
    changed?: boolean;
    actionApplied?: boolean;
    noOpReason?: string | null;
    safeVariantApplied?: boolean;
  };
};

type PipelineOutputId = "social" | "linkedin" | "email";

type PipelineOutput = {
  id: PipelineOutputId;
  useCase: string;
  output: string;
  proof?: ProofResult;
};

type PipelineOk = {
  pipelineVersion: string;
  template: "content_pack";
  usageCost: number;
  outputs: PipelineOutput[];
  mode: string;
  model: string;
  plan: "PRO";
  used: number;
  limit: number;
  renewAt: number;
  cancelAt: number;
};
type QuickActionType = "shorten" | "structure" | "cta" | "headline" | "tone";

type QuickActionResultMeta = {
  changed: boolean;
  actionApplied: boolean;
  noOpReason?: string | null;
  safeVariantApplied?: boolean;
};

type CanvasSnapshot = {
  output: string;
  proof: ProofResult | null;
};

type PipelineEditState = Partial<
  Record<
    PipelineOutputId,
    {
      previousCanvas: CanvasSnapshot | null;
      lastQuickAction: QuickActionType | null;
      lastQuickActionMeta: QuickActionResultMeta | null;
    }
  >
>;

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
const LS_PROFILE = "gle_magic_context_profile_v1";

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
  const [context, setContext] = useState("");
  const [language, setLanguage] = useState<"de" | "en">("de");
  const [boost, setBoost] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("");

  // App-State
  const [me, setMe] = useState<Me | null>(null);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineOutputs, setPipelineOutputs] = useState<PipelineOutput[]>([]);
  const [activePipelineOutputId, setActivePipelineOutputId] =
    useState<PipelineOutputId>("social");
  const [busy, setBusy] = useState(false);
  const [quickActionBusy, setQuickActionBusy] = useState<QuickActionType | null>(null);
  const [quickTone, setQuickTone] = useState("Professionell");
  const [previousCanvas, setPreviousCanvas] = useState<CanvasSnapshot | null>(null);
  const [pipelineEditByOutput, setPipelineEditByOutput] =
    useState<PipelineEditState>({});
  const [lastQuickAction, setLastQuickAction] = useState<QuickActionType | null>(null);
  const [lastQuickActionMeta, setLastQuickActionMeta] = useState<QuickActionResultMeta | null>(null);
  const [output, setOutput] = useState("");
  const [proof, setProof] = useState<ProofResult | null>(null);
  const [promptHistory, setPromptHistory] = useState<PromptHistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [packCopied, setPackCopied] = useState(false);
  const [err, setErr] = useState<AnyErr | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const showDevActions = false;

  function getPresetFor(_nextUseCase: string, _nextLanguage: "de" | "en") {
    // Form fields must never inject GLE demo data automatically.
    // Guided structure stays opt-in via the Structure Matrix button below.
    return { goal: "", context: "" };
  }
  const useCaseHelp: Record<string, string> = {
    "Landingpage / Ad-Copy": `Was du eintragen solltest:
- Angebot oder Produkt
- Zielgruppe
- wichtigster Nutzen
- Preis, Verfügbarkeit oder Zugangshinweis
- gewünschte CTA

Beispiel:
Onlinekurs für besseres Zeitmanagement.
Zielgruppe: Selbstständige und kleine Teams.
Nutzen: weniger Planungsaufwand und klarere Prioritäten.
CTA: Mehr erfahren.`,

    "Social Media Post": `Was du eintragen solltest:
- Plattform
- Thema
- Zielgruppe
- Kernaussage
- gewünschte Länge oder Stil

Beispiel:
Instagram-Post über ergonomisches Arbeiten im Homeoffice.
Zielgruppe: Berufstätige im Homeoffice.
Aussage: Kleine Anpassungen können den Arbeitsalltag angenehmer machen.
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
Produktbeschreibung für einen höhenverstellbaren Laptopständer.
Zielgruppe: Menschen im Homeoffice.
Vorteile: flexible Arbeitshöhe, kompakte Bauform, schneller Aufbau.`,

    "E-Mail": `Was du eintragen solltest:
- Empfänger/Zielgruppe
- Ziel der E-Mail
- Kernaussage
- gewünschte CTA
- Ton

Beispiel:
E-Mail an Interessenten eines Online-Webinars.
Ziel: Termin und Nutzen kurz erklären.
CTA: Platz reservieren.`,

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
TikTok/Reel über produktiveres Arbeiten im Homeoffice.
Hook: Verlierst du morgens Zeit, bevor du richtig anfängst?
Zielgruppe: Berufstätige im Homeoffice.`,
  };

  const useCaseHelpEn: Record<string, string> = {
    "Landingpage / Ad-Copy": `What you should enter:
- offer or product
- target audience
- main benefit
- price, availability or access note
- desired CTA

Example:
Online course for better time management.
Target audience: freelancers and small teams.
Benefit: less planning effort and clearer priorities.
CTA: Learn more.`,

    "Social Media Post": `What you should enter:
- platform
- topic
- target audience
- core message
- desired length or style

Example:
Instagram post about ergonomic home-office habits.
Target audience: people working from home.
Message: Small adjustments can make daily work more comfortable.
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
Product description for an adjustable laptop stand.
Target audience: people working from home.
Benefits: flexible height, compact design, quick setup.`,

    "E-Mail": `What you should enter:
- recipient or target audience
- goal of the email
- core message
- desired CTA
- tone

Example:
Email to people interested in an online webinar.
Goal: explain the date and key benefit briefly.
CTA: Reserve a seat.`,

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
TikTok/Reel about working more productively from home.
Hook: Do you lose time before you really get started?
Target audience: people working from home.`,
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
          historyTitle: "Prompt Library",
          historyHint:
            "Your latest generated prompts are saved locally in this browser.",
          historyOpen: "Open",
          historyClear: "Clear",
          historyEmptyTopic: "No topic",
        }
      : {
          generate: "Prompt erstellen",
          copy: "Ausgabe kopieren",
          result: "Ergebnis",
          historyTitle: "Prompt Library",
          historyHint:
            "Deine letzten erstellten Prompts werden lokal in diesem Browser gespeichert.",
          historyOpen: "Öffnen",
          historyClear: "Leeren",
          historyEmptyTopic: "Ohne Thema",
        };

  useEffect(() => {
    setGoal("");
    setContext("");
  }, [language]);

  // Init: IDs + apiKey aus localStorage
  useEffect(() => {
    try {
      const a = localStorage.getItem(LS_ACCOUNT);
      const u = localStorage.getItem(LS_USER);
      const k = localStorage.getItem(LS_APIKEY);
      const p = localStorage.getItem(LS_PROFILE);

      if (!a) localStorage.setItem(LS_ACCOUNT, `acc_${safeUUID()}`);
      if (!u) localStorage.setItem(LS_USER, `u_${safeUUID()}`);

      setAccountId((a || localStorage.getItem(LS_ACCOUNT) || "").trim());
      setUserId((u || localStorage.getItem(LS_USER) || "").trim());
      setApiKey((k || "").trim());
      setSelectedProfileId((p || "").trim());
    } catch {
      // ignore
    }
  }, []);

  // Init: Prompt Library aus localStorage laden
  useEffect(() => {
    setPromptHistory(loadPromptHistory());
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

  useEffect(() => {
    try {
      if (selectedProfileId) localStorage.setItem(LS_PROFILE, selectedProfileId);
      else localStorage.removeItem(LS_PROFILE);
    } catch {
      // ignore
    }
  }, [selectedProfileId]);

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
    if (quickActionBusy) return;
    const startedAt = Date.now();

    if (!String(goal || "").trim()) {
      setOutput("");
      setProof(null);
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
    setProof(null);
    setCopied(false);
    setPipelineOutputs([]);
    setPipelineEditByOutput({});
    setActivePipelineOutputId("social");
    setPreviousCanvas(null);
    setLastQuickAction(null);
    setLastQuickActionMeta(null);

    try {
      const body = mapGenerateBody({
        useCase,
        tone,
        goal,
        context,
        language,
        boost,
        profileId: selectedProfileId,
      });

      const res = await apiPost<GenOk>("/api/generate", body, headers);

      if (res.ok) {
        const newOutput = res.output || "";

        setOutput(newOutput);
        setProof(res.proof || null);
        setEngineLabel(String(res.model || "").trim());

        addPromptToHistory({
          useCase,
          tone,
          topic: goal,
          language,
          output: newOutput,
        });

        await refreshMe();
      } else {
        setProof(null);
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
  async function onGenerateContentPack() {
    if (busy || quickActionBusy || pipelineBusy) return;

    if (!String(goal || "").trim()) {
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

    if (me?.plan !== "PRO") {
      setErr({
        ok: false,
        error: "pipeline_requires_pro",
        message:
          language === "en"
            ? "The Content Pack is available in PRO."
            : "Das Content Pack ist im PRO-Plan verfügbar.",
      });
      return;
    }

    const startedAt = Date.now();

    setPipelineBusy(true);
    setErr(null);
    setCopied(false);
    setPipelineOutputs([]);
    setPipelineEditByOutput({});
    setPreviousCanvas(null);
    setLastQuickAction(null);
    setLastQuickActionMeta(null);

    try {
      const res = await apiPost<PipelineOk>(
        "/api/pipeline",
        {
          template: "content_pack",
          topic: String(goal).trim(),
          tone,
          outLang: language === "en" ? "EN" : "DE",
          extra: String(context || "").trim() || undefined,
          profileId: selectedProfileId || undefined,
        },
        headers,
      );

      if (res.ok) {
        const outputs = Array.isArray(res.outputs)
          ? res.outputs.filter((item) => String(item?.output || "").trim())
          : [];

        if (!outputs.length) {
          setErr({
            ok: false,
            error: "empty_pipeline",
            message:
              language === "en"
                ? "The Content Pack returned no results."
                : "Das Content Pack hat keine Ergebnisse geliefert.",
          });
          return;
        }

        const firstOutput = outputs[0];

        setPipelineOutputs(outputs);
        setActivePipelineOutputId(firstOutput.id);
        setOutput(firstOutput.output);
        setProof(firstOutput.proof || null);
        setEngineLabel(String(res.model || "").trim());

        await refreshMe();
      } else {
        setPipelineOutputs([]);
        setProof(null);
        setErr(res as AnyErr);
      }
    } catch (e: any) {
      setPipelineOutputs([]);
      setProof(null);
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

      setPipelineBusy(false);
    }
  }
  async function onQuickAction(actionType: QuickActionType, targetTone?: string) {
    const currentOutput = String(output || "").trim();
    if (!currentOutput || busy || quickActionBusy) return;

    const activePipelineItem =
      pipelineOutputs.find(
        (item) => item.id === activePipelineOutputId,
      ) || null;

    const quickActionUseCase =
      activePipelineItem?.useCase || useCase;

    setQuickActionBusy(actionType);
    setErr(null);
    setCopied(false);
    setLastQuickAction(null);
    setLastQuickActionMeta(null);

    try {
      const res = await apiPost<TransformOk>(
        "/api/transform",
        {
          currentOutput,
          actionType,
          useCase: quickActionUseCase,
          tone,
          targetTone: actionType === "tone" ? String(targetTone || quickTone).trim() : undefined,
          outLang: language === "en" ? "EN" : "DE",
          profileId: selectedProfileId || undefined,
        },
        headers,
      );

      if (res.ok) {
        const nextOutput = String(res.output || "").trim();
        if (!nextOutput) {
          setErr({
            ok: false,
            error: "empty_transform",
            message:
              language === "en"
                ? "The Quick Action returned an empty result."
                : "Die Quick Action hat kein Ergebnis geliefert.",
          });
          return;
        }

        const apiChanged = res.transform?.changed;
        const changed =
          typeof apiChanged === "boolean"
            ? apiChanged
            : nextOutput.replace(/\r\n/g, "\n") !== currentOutput.replace(/\r\n/g, "\n");
        const actionApplied = res.transform?.actionApplied ?? changed;
        const meta: QuickActionResultMeta = {
          changed: changed && actionApplied,
          actionApplied,
          noOpReason: res.transform?.noOpReason || null,
          safeVariantApplied: !!res.transform?.safeVariantApplied,
        };

        setEngineLabel(String(res.model || "").trim());
        setLastQuickAction(actionType);
        setLastQuickActionMeta(meta);

        if (!meta.changed) {
          if (activePipelineItem) {
            setPipelineEditByOutput((states) => ({
              ...states,
              [activePipelineOutputId]: {
                previousCanvas:
                  states[activePipelineOutputId]?.previousCanvas || null,
                lastQuickAction: actionType,
                lastQuickActionMeta: meta,
              },
            }));
          }

          // Honest no-op: keep Canvas output, Proof and Undo state exactly as they
          // were. The server still audited the transform attempt and usage is
          // refreshed below.
          await refreshMe();
          return;
        }

        const previousSnapshot: CanvasSnapshot = {
          output: currentOutput,
          proof,
        };

        setPreviousCanvas(previousSnapshot);
        setOutput(nextOutput);
        setProof(res.proof || null);

        if (activePipelineItem) {
          setPipelineOutputs((items) =>
            items.map((item) =>
              item.id === activePipelineOutputId
                ? {
                    ...item,
                    output: nextOutput,
                    proof: res.proof || undefined,
                  }
                : item,
            ),
          );

          setPipelineEditByOutput((states) => ({
            ...states,
            [activePipelineOutputId]: {
              previousCanvas: previousSnapshot,
              lastQuickAction: actionType,
              lastQuickActionMeta: meta,
            },
          }));
        }

        addPromptToHistory({
          useCase: quickActionUseCase,
          tone: actionType === "tone" ? String(targetTone || quickTone).trim() || tone : tone,
          topic: goal,
          language,
          output: nextOutput,
        });

        await refreshMe();
      } else {
        setErr(res as AnyErr);
      }
    } catch (e: any) {
      setErr({
        ok: false,
        error: "quick_action_client_error",
        message: e?.message || String(e),
      });
    } finally {
      setQuickActionBusy(null);
    }
  }

  function undoQuickAction() {
    if (!previousCanvas || busy || quickActionBusy) return;

    setOutput(previousCanvas.output);
    setProof(previousCanvas.proof);

    if (pipelineOutputs.length > 0) {
      setPipelineOutputs((items) =>
        items.map((item) =>
          item.id === activePipelineOutputId
            ? {
                ...item,
                output: previousCanvas.output,
                proof: previousCanvas.proof || undefined,
              }
            : item,
        ),
      );

      setPipelineEditByOutput((states) => {
        const next = { ...states };
        delete next[activePipelineOutputId];
        return next;
      });
    }

    setPreviousCanvas(null);
    setLastQuickAction(null);
    setLastQuickActionMeta(null);
    setErr(null);
    setCopied(false);
  }

  function quickActionNoOpText(reason?: string | null) {
    const de: Record<string, string> = {
      already_compact: "Text ist bereits kompakt – keine Änderung nötig.",
      already_structured: "Text ist bereits passend strukturiert – keine Änderung nötig.",
      cta_already_clear: "CTA ist bereits klar – keine Änderung nötig.",
      headline_already_clear: "Headline ist bereits klar – keine Änderung nötig.",
      no_safe_tone_change: "Kein sinnvoller sicherer Tonwechsel nötig.",
      action_not_safely_applicable: "Keine sichere sinnvolle Änderung gefunden – Canvas bleibt unverändert.",
      no_visible_change: "Keine sichtbare Änderung nötig.",
    };
    const en: Record<string, string> = {
      already_compact: "The text is already compact — no change needed.",
      already_structured: "The text is already well structured — no change needed.",
      cta_already_clear: "The CTA is already clear — no change needed.",
      headline_already_clear: "The headline is already clear — no change needed.",
      no_safe_tone_change: "No meaningful safe tone change was needed.",
      action_not_safely_applicable: "No safe meaningful change was found — the Canvas stays unchanged.",
      no_visible_change: "No visible change was needed.",
    };
    const map = language === "en" ? en : de;
    return map[String(reason || "")] || map.no_visible_change;
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
    setProof(null);
  }

  function addPromptToHistory(item: {
    useCase: string;
    tone: string;
    topic: string;
    language: string;
    output: string;
  }) {
    const cleanedOutput = String(item.output || "").trim();
    if (!cleanedOutput) return;

    const isProUser = String(me?.plan || "").toUpperCase() === "PRO";
    const maxItems = isProUser ? 20 : 3;

    const entry: PromptHistoryItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      useCase: item.useCase || "",
      tone: item.tone || "",
      topic: item.topic || "",
      language: item.language || "de",
      output: cleanedOutput,
    };

    const next = [entry, ...promptHistory].slice(0, maxItems);

    setPromptHistory(next);
    savePromptHistory(next);
  }

  function openPromptFromHistory(item: PromptHistoryItem) {
    setOutput(item.output || "");
    setProof(null);
    setPreviousCanvas(null);
    setLastQuickAction(null);
    setCopied(false);
    setErr(null);
  }

  function clearPromptHistory() {
    setPromptHistory([]);
    savePromptHistory([]);
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // ignore
    }
  }

  async function copyContentPack() {
    if (!pipelineOutputs.length) return;

    const labels: Record<PipelineOutputId, string> = {
      social: "SOCIAL MEDIA",
      linkedin: "LINKEDIN",
      email: language === "en" ? "EMAIL" : "E-MAIL",
    };

    const packText = pipelineOutputs
      .map((item) => {
        const label = labels[item.id] || item.useCase;
        return `===== ${label} =====\n\n${String(item.output || "").trim()}`;
      })
      .join("\n\n\n");

    try {
      await navigator.clipboard.writeText(packText);
      setPackCopied(true);
      window.setTimeout(() => setPackCopied(false), 1600);
    } catch {
      setErr({
        ok: false,
        error: "clipboard_failed",
        message:
          language === "en"
            ? "The Content Pack could not be copied."
            : "Das Content Pack konnte nicht kopiert werden.",
      });
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
Price/note: [optional: price, availability or access note]
Desired CTA: [e.g. learn more, request access, buy now]

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
Preis/Hinweis: [optional: Preis, Verfügbarkeit oder Zugangshinweis]
Gewünschte CTA: [z.B. Mehr erfahren, Zugang anfragen, Jetzt kaufen]

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
        Prompt Studio
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

      <div className="gle-workbench">
        <section className="gle-briefing-pane">
          <div className="gle-pane-kicker">
            {language === "en" ? "Briefing" : "Briefing"}
          </div>
          <h2 className="gle-pane-title">
            {language === "en" ? "Input & context" : "Input & Kontext"}
          </h2>
          <p className="gle-pane-copy">
            {language === "en"
              ? "Define the task, select Magic Context and fine-tune the structure."
              : "Aufgabe festlegen, Magic Context wählen und die Struktur feinsteuern."}
          </p>

          <MagicContextPanel
        headers={headers}
        language={language}
        selectedProfileId={selectedProfileId}
        onSelectProfile={(profileId) => {
          setSelectedProfileId(profileId);
          setProof(null);
        }}
        disabled={busy}
      />

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
              setProof(null);
              setErr(null);
            }}
            style={blueSelectStyle}
          >
            <option style={blueOptionStyle} value="Landingpage / Ad-Copy">
              {language === "en"
                ? "Landing page / Ad copy"
                : "Landingpage / Ad-Copy"}
            </option>

            <option style={blueOptionStyle} value="Social Media Post">
              Social Media Post
            </option>

            <option style={blueOptionStyle} value="LinkedIn Post">
              LinkedIn Post
            </option>

            <option style={blueOptionStyle} value="Produktbeschreibung">
              {language === "en"
                ? "Product description"
                : "Produktbeschreibung"}
            </option>

            <option style={blueOptionStyle} value="E-Mail">
              {language === "en" ? "Email" : "E-Mail"}
            </option>

            <option style={blueOptionStyle} value="Blogartikel">
              {language === "en" ? "Blog article" : "Blogartikel"}
            </option>

            <option style={blueOptionStyle} value="Kurzvideo-Skript">
              {language === "en" ? "Short video script" : "Kurzvideo-Skript"}
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
            <option style={blueOptionStyle} value="Neutral">
              Neutral
            </option>

            <option style={blueOptionStyle} value="Professionell">
              {language === "en" ? "Professional" : "Professionell"}
            </option>

            <option style={blueOptionStyle} value="Locker">
              {language === "en" ? "Casual" : "Locker"}
            </option>

            <option style={blueOptionStyle} value="Motivierend">
              {language === "en" ? "Motivating" : "Motivierend"}
            </option>

            <option style={blueOptionStyle} value="Verkaufstark">
              {language === "en" ? "Sales-focused" : "Verkaufstark"}
            </option>

            <option style={blueOptionStyle} value="Direkt">
              {language === "en" ? "Direct" : "Direkt"}
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
              setProof(null);
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
        <button
          onClick={onGenerate}
          disabled={busy || pipelineBusy || !!quickActionBusy}
          style={btnPrimary}
        >
          {busy
            ? language === "en"
              ? "Creating prompt..."
              : "Prompt wird erstellt..."
            : uiText.generate}
        </button>

        <button
          type="button"
          onClick={onGenerateContentPack}
          disabled={busy || pipelineBusy || !!quickActionBusy}
          style={{
            ...btnSecondary,
            border: "1px solid rgba(168, 85, 247, 0.72)",
            background: "rgba(126, 34, 206, 0.18)",
            color: "#e9d5ff",
            fontWeight: 800,
          }}
          title={
            language === "en"
              ? "Creates Social, LinkedIn and Email outputs · 3 uses"
              : "Erstellt Social, LinkedIn und E-Mail · 3 Nutzungen"
          }
        >
          {pipelineBusy
            ? language === "en"
              ? "Creating Content Pack..."
              : "Content Pack wird erstellt..."
            : language === "en"
              ? "✨ Content Pack PRO · 3 uses"
              : "✨ Content Pack PRO · 3 Nutzungen"}
        </button>
      </div>
        </section>

        <section className="gle-canvas-pane">
          <div className="gle-canvas-toolbar">
            <div>
              <div className="gle-pane-kicker">Canvas</div>
              <h2 className="gle-pane-title">{uiText.result}</h2>
              <p className="gle-pane-copy">
                {language === "en"
                  ? "Your generated asset and Proof status stay visible here."
                  : "Dein Ergebnis und der Proof-Status bleiben hier im Blick."}
              </p>
            </div>
            <button
              onClick={() => {
                copyOutput();
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              }}
              disabled={!output}
              style={btnSecondary}
            >
              {copied ? (language === "en" ? "COPIED!" : "KOPIERT!") : uiText.copy}
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
              (language === "en"
                ? [
                    "Analyzing",
                    "Building structure",
                    "Optimizing",
                    "Finalizing",
                  ]
                : [
                    "Analyse läuft",
                    "Struktur wird gebaut",
                    "Optimierung läuft",
                    "Finalisierung",
                  ])[loadingStep]
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
      {!busy && !err && !output && (
        <div className="gle-canvas-empty">
          <div className="gle-canvas-empty-mark">GLE</div>
          <div className="gle-canvas-empty-title">
            {language === "en" ? "Ready for your next output" : "Bereit für dein nächstes Ergebnis"}
          </div>
          <div className="gle-canvas-empty-copy">
            {language === "en"
              ? "Complete the briefing on the left and create your prompt. The result will appear here without losing sight of your inputs."
              : "Fülle links dein Briefing aus und erstelle den Prompt. Das Ergebnis erscheint hier, ohne dass dein Input aus dem Blick verschwindet."}
          </div>
        </div>
      )}

      {output && (
        <div style={outputPanelStyle}>
          <div style={outputHeaderStyle}>
            <span>{uiText.result}</span>
            <span style={{ fontSize: 11, opacity: 0.65 }}>Fertig</span>
          </div>
          {pipelineOutputs.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 14,
                padding: 8,
                borderRadius: 12,
                border: "1px solid rgba(168, 85, 247, 0.30)",
                background: "rgba(126, 34, 206, 0.08)",
              }}
            >
              {pipelineOutputs.map((item) => {
                const active = item.id === activePipelineOutputId;
                const label =
                  item.id === "social"
                    ? "Social"
                    : item.id === "linkedin"
                      ? "LinkedIn"
                      : language === "en"
                        ? "Email"
                        : "E-Mail";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const editState = pipelineEditByOutput[item.id];

                      setActivePipelineOutputId(item.id);
                      setOutput(item.output);
                      setProof(item.proof || null);
                      setCopied(false);
                      setPreviousCanvas(editState?.previousCanvas || null);
                      setLastQuickAction(editState?.lastQuickAction || null);
                      setLastQuickActionMeta(
                        editState?.lastQuickActionMeta || null,
                      );
                    }}
                    disabled={busy || pipelineBusy || !!quickActionBusy}
                    style={{
                      borderRadius: 9,
                      border: active
                        ? "1px solid rgba(216, 180, 254, 0.95)"
                        : "1px solid rgba(255,255,255,0.12)",
                      background: active
                        ? "rgba(147, 51, 234, 0.34)"
                        : "rgba(255,255,255,0.04)",
                      color: active ? "#f3e8ff" : "#cfd2dc",
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor:
                        busy || pipelineBusy || !!quickActionBusy
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}

              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#c4b5fd",
                    fontWeight: 700,
                  }}
                >
                  PRO Content Pack
                </span>

                <button
                  type="button"
                  onClick={copyContentPack}
                  disabled={busy || !!quickActionBusy || pipelineBusy}
                  title={
                    language === "en"
                      ? "Copy all three Content Pack outputs"
                      : "Alle drei Content-Pack-Texte kopieren"
                  }
                  style={{
                    border: "1px solid rgba(196,181,253,.35)",
                    background: "rgba(139,92,246,.12)",
                    color: "#ddd6fe",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor:
                      busy || !!quickActionBusy || pipelineBusy
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      busy || !!quickActionBusy || pipelineBusy ? 0.6 : 1,
                  }}
                >
                  {packCopied
                    ? language === "en"
                      ? "✓ Copied"
                      : "✓ Kopiert"
                    : language === "en"
                      ? "Copy all"
                      : "Alle kopieren"}
                </button>
              </div>
            </div>
          ) : null}

          {proof ? <ProofStatusBadge proof={proof} language={language} /> : null}

          <div className="gle-quick-actions">
            <div className="gle-quick-actions-head">
              <div>
                <div className="gle-quick-actions-kicker">Quick Actions</div>
                <div className="gle-quick-actions-copy">
                  {language === "en"
                    ? "Refine the current Canvas output without leaving the workspace."
                    : "Aktuellen Canvas-Text direkt weiterbearbeiten – ohne den Workspace zu verlassen."}
                </div>
              </div>

              {previousCanvas ? (
                <button
                  type="button"
                  className="gle-quick-action-undo"
                  onClick={undoQuickAction}
                  disabled={busy || !!quickActionBusy}
                >
                  {language === "en" ? "Undo" : "Rückgängig"}
                </button>
              ) : null}
            </div>

            <div className="gle-quick-actions-row">
              <button
                type="button"
                className="gle-quick-action-btn"
                onClick={() => onQuickAction("shorten")}
                disabled={busy || !!quickActionBusy}
              >
                {quickActionBusy === "shorten"
                  ? language === "en" ? "Shortening…" : "Kürze…"
                  : language === "en" ? "Shorten" : "Kürzen"}
              </button>

              <button
                type="button"
                className="gle-quick-action-btn"
                onClick={() => onQuickAction("structure")}
                disabled={busy || !!quickActionBusy}
              >
                {quickActionBusy === "structure"
                  ? language === "en" ? "Structuring…" : "Strukturiere…"
                  : language === "en" ? "Structure" : "Strukturieren"}
              </button>

              <button
                type="button"
                className="gle-quick-action-btn"
                onClick={() => onQuickAction("cta")}
                disabled={busy || !!quickActionBusy}
              >
                {quickActionBusy === "cta"
                  ? language === "en" ? "Improving CTA…" : "CTA wird verbessert…"
                  : "CTA"}
              </button>

              <button
                type="button"
                className="gle-quick-action-btn"
                onClick={() => onQuickAction("headline")}
                disabled={busy || !!quickActionBusy}
              >
                {quickActionBusy === "headline"
                  ? language === "en" ? "Improving headline…" : "Headline wird verbessert…"
                  : "Headline"}
              </button>
            </div>

            <div className="gle-quick-tone-row">
              <select
                value={quickTone}
                onChange={(e) => setQuickTone(e.target.value)}
                className="gle-quick-tone-select"
                disabled={busy || !!quickActionBusy}
                aria-label={language === "en" ? "Target tone" : "Zielton"}
              >
                <option value="Neutral">Neutral</option>
                <option value="Professionell">{language === "en" ? "Professional" : "Professionell"}</option>
                <option value="Locker">{language === "en" ? "Casual" : "Locker"}</option>
                <option value="Motivierend">{language === "en" ? "Motivating" : "Motivierend"}</option>
                <option value="Verkaufstark">{language === "en" ? "Sales-focused" : "Verkaufstark"}</option>
                <option value="Direkt">{language === "en" ? "Direct" : "Direkt"}</option>
              </select>
              <button
                type="button"
                className="gle-quick-action-btn gle-quick-action-tone"
                onClick={() => onQuickAction("tone", quickTone)}
                disabled={busy || !!quickActionBusy}
              >
                {quickActionBusy === "tone"
                  ? language === "en" ? "Changing tone…" : "Ton wird geändert…"
                  : language === "en" ? "Change tone" : "Ton ändern"}
              </button>
            </div>

            {lastQuickAction && lastQuickActionMeta && !quickActionBusy ? (
              <div
                className={`gle-quick-action-status ${
                  lastQuickActionMeta.changed ? "is-success" : "is-noop"
                }`}
              >
                <span className="gle-quick-action-status-dot" />
                {lastQuickActionMeta.changed
                  ? language === "en"
                    ? "Quick Action applied · Proof refreshed"
                    : "Quick Action angewendet · Proof neu geprüft"
                  : quickActionNoOpText(lastQuickActionMeta.noOpReason)}
              </div>
            ) : null}
          </div>

          <pre style={outputPreStyle}>{output}</pre>
        </div>
      )}
        </section>
      </div>

      {promptHistory.length > 0 && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {uiText.historyTitle}
              </h2>
              <p className="mt-1 text-xs text-white/60">{uiText.historyHint}</p>
            </div>

            <button
              type="button"
              onClick={clearPromptHistory}
              className="rounded-xl border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
            >
              {uiText.historyClear}
            </button>
          </div>

          <div className="space-y-2">
            {promptHistory.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openPromptFromHistory(item)}
                className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">
                    {item.useCase || "Prompt"}
                  </span>

                  <span className="text-xs text-white/50">
                    {new Date(item.createdAt).toLocaleDateString(
                      language === "en" ? "en-US" : "de-DE",
                    )}
                  </span>
                </div>

                <div className="mt-1 truncate text-xs text-white/60">
                  {item.topic || uiText.historyEmptyTopic}
                </div>

                <div className="mt-2 text-xs text-emerald-300">
                  {uiText.historyOpen}
                </div>
              </button>
            ))}
          </div>
        </section>
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
  width: "min(1480px, calc(100% - 20px))",
  margin: "20px auto",
  padding: "clamp(16px, 2.2vw, 30px)",
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
