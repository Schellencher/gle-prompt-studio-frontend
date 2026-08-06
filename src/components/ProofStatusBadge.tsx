"use client";

import React from "react";

export type ProofResult = {
  status?: string;
  mode?: string;
  applied?: boolean;
  reason?: string;
  action?: string;
  scope?: string;
  profileId?: string | null;
  profileVersion?: number | null;
  factCount?: number;
  verifiedFactCount?: number;
  approvedFactIds?: string[];
  matchedFactIds?: string[];
  factVersions?: Array<{ id?: string; version?: number }>;
  worldTruthVerified?: boolean;

  claimCount?: number;
  verifiedClaimCount?: number;
  rejectedClaimCount?: number;
  rejectedClaims?: Array<{
    text?: string;
    reason?: string;
    matchedFactIds?: string[];
    unsupportedTokens?: string[];
    unsupportedNumbers?: string[];
    unsupportedTechnicalCodes?: string[];
  }>;

  safeOutputApplied?: boolean;
  safeOutputVerifiedClaimCount?: number;
  pipelineSafeOutputApplied?: boolean;
  pipelineSafeOutputVerifiedClaimCount?: number;
  pipelineSafeOutputRejectedClaimCount?: number;
  humanReviewRequired?: boolean;
  finalOutputVerified?: boolean;
};

type Props = {
  proof: ProofResult;
  language: "de" | "en";
};

const reasonText: Record<string, { de: string; en: string }> = {
  no_profile: {
    de: "Kein Magic-Context-Profil ausgewählt.",
    en: "No Magic Context profile selected.",
  },
  use_case_not_yet_supported: {
    de: "Dieser Use-Case wird vom Fact Guard noch nicht verifiziert.",
    en: "This use case is not verified by Fact Guard yet.",
  },
  no_approved_proof_facts: {
    de: "Im Profil sind keine freigegebenen Proof Facts vorhanden.",
    en: "The profile has no approved Proof Facts.",
  },
};

function clampCount(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export default function ProofStatusBadge({ proof, language }: Props) {
  const isEn = language === "en";
  const status = String(proof?.status || "NOT_VERIFIED").toUpperCase();
  const passed = status === "PASSED";
  const safeRewrite = status === "SAFE_REWRITE" || status === "SAFE REWRITE";
  const review = status === "REVIEW_REQUIRED" || status === "REVIEW REQUIRED";
  const blocked = status === "BLOCKED";

  const factCount = clampCount(proof?.factCount);
  const verifiedFactCount = Math.min(
    factCount || clampCount(proof?.verifiedFactCount),
    clampCount(proof?.verifiedFactCount),
  );
  const profileVersion = clampCount(proof?.profileVersion);

  const claimCount = clampCount(proof?.claimCount);
  const verifiedClaimCount = clampCount(proof?.verifiedClaimCount);
  const rejectedClaimCount = clampCount(proof?.rejectedClaimCount);
  const safeOutputApplied = proof?.safeOutputApplied === true;
  const pipelineSafeOutputApplied =
    proof?.pipelineSafeOutputApplied === true;
  const pipelineSafeOutputRejectedClaimCount = clampCount(
    proof?.pipelineSafeOutputRejectedClaimCount,
  );

  const palette = passed
    ? {
        border: "rgba(34,197,94,0.62)",
        bg: "rgba(22,163,74,0.14)",
        text: "#bbf7d0",
        dot: "#22c55e",
      }
    : safeRewrite
      ? {
          border: "rgba(249,115,22,0.62)",
          bg: "rgba(249,115,22,0.12)",
          text: "#fed7aa",
          dot: "#f97316",
        }
      : review
        ? {
            border: "rgba(245,158,11,0.62)",
            bg: "rgba(245,158,11,0.12)",
            text: "#fde68a",
            dot: "#f59e0b",
          }
      : blocked
        ? {
            border: "rgba(239,68,68,0.62)",
            bg: "rgba(239,68,68,0.12)",
            text: "#fecaca",
            dot: "#ef4444",
          }
        : {
            border: "rgba(148,163,184,0.45)",
            bg: "rgba(148,163,184,0.09)",
            text: "#cbd5e1",
            dot: "#94a3b8",
          };

  const statusLabel = passed
    ? "PASSED"
    : safeRewrite
      ? "SAFE REWRITE"
      : review
        ? "REVIEW REQUIRED"
      : blocked
        ? "BLOCKED"
        : "NOT VERIFIED";

  const countLabel =
    factCount > 0
      ? `${verifiedFactCount}/${factCount} Proof Facts`
      : "";

  const versionLabel =
    profileVersion > 0
      ? `${isEn ? "Profile" : "Profil"} v${profileVersion}`
      : "";

  const summary = [
    statusLabel,
    pipelineSafeOutputApplied
      ? (isEn ? "Final output verified ✓" : "Endfassung geprüft ✓")
      : "",
    pipelineSafeOutputApplied
      ? `${pipelineSafeOutputRejectedClaimCount} ${
          isEn ? "rejected claims" : "abgelehnte Claims"
        }`
      : "",
    countLabel,
    versionLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  const knownReason = proof?.reason
    ? reasonText[String(proof.reason)]
    : undefined;

  let explanation: string;

  if (passed) {
    explanation = isEn
      ? "Checked against the approved facts in the selected profile. This does not verify external world truth."
      : "Gegen die freigegebenen Fakten im ausgewählten Profil geprüft. Dies bestätigt keine externe Weltwahrheit.";
  } else if (safeRewrite && pipelineSafeOutputApplied) {
    explanation = isEn
      ? "The AI draft contained unsupported claims. GLE rebuilt the final PRO output from the approved Proof Facts and verified that final output again."
      : "Der KI-Entwurf enthielt nicht freigegebene Claims. GLE hat die PRO-Endfassung aus den freigegebenen Proof Facts neu aufgebaut und diese Endfassung anschließend erneut geprüft.";
  } else if (
    safeRewrite &&
    safeOutputApplied &&
    proof?.reason === "unsupported_claims_detected"
  ) {
    explanation = isEn
      ? "Unapproved claims were detected in the AI draft. GLE therefore replaced it with a safe version built only from the approved Proof Facts."
      : "Im KI-Entwurf wurden nicht freigegebene Claims erkannt. GLE hat deshalb eine sichere Version ausschließlich aus den freigegebenen Proof Facts ausgegeben.";
  } else if (
    safeRewrite &&
    safeOutputApplied &&
    proof?.reason === "incomplete_fact_coverage"
  ) {
    explanation = isEn
      ? "The AI draft did not cover all approved Proof Facts. GLE therefore replaced it with a safe, complete version built only from the approved Proof Facts."
      : "Der KI-Entwurf hat nicht alle freigegebenen Proof Facts abgedeckt. GLE hat deshalb eine sichere, vollständige Version ausschließlich aus den freigegebenen Proof Facts ausgegeben.";
  } else if (safeRewrite && safeOutputApplied) {
    explanation = isEn
      ? "The AI draft required review. GLE replaced it with a safe version built only from the approved Proof Facts."
      : "Der KI-Entwurf erforderte eine Prüfung. GLE hat ihn durch eine sichere Version ausschließlich aus den freigegebenen Proof Facts ersetzt.";
  } else if (knownReason) {
    explanation = isEn ? knownReason.en : knownReason.de;
  } else if (review) {
    explanation = isEn
      ? "GLE detected claims that still require review before the output can be treated as verified."
      : "GLE hat Claims erkannt, die noch geprüft werden müssen, bevor die Ausgabe als verifiziert gelten kann.";
  } else if (blocked) {
    explanation = isEn
      ? "GLE blocked this output because the proof rules were not satisfied."
      : "GLE hat diese Ausgabe blockiert, weil die Proof-Regeln nicht erfüllt wurden.";
  } else {
    explanation = isEn
      ? "This output has not been verified by GLE Proof-of-Execution."
      : "Diese Ausgabe wurde noch nicht durch GLE Proof-of-Execution verifiziert.";
  }

  const showClaimStats =
    claimCount > 0 &&
    (passed || safeRewrite || review) &&
    (verifiedClaimCount > 0 || rejectedClaimCount > 0);

  const claimStats = safeRewrite
    ? isEn
      ? `AI draft: ${claimCount} claims checked · ${verifiedClaimCount} confirmed · ${rejectedClaimCount} rejected`
      : `KI-Entwurf: ${claimCount} Claims geprüft · ${verifiedClaimCount} bestätigt · ${rejectedClaimCount} abgelehnt`
    : isEn
      ? `${claimCount} claims checked · ${verifiedClaimCount} confirmed · ${rejectedClaimCount} rejected`
      : `${claimCount} Claims geprüft · ${verifiedClaimCount} bestätigt · ${rejectedClaimCount} abgelehnt`;

  return (
    <div
      style={{
        margin: "10px 0 12px",
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
      }}
      aria-label={`GLE Proof Status: ${statusLabel}`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: palette.text,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.01em",
          flexWrap: "wrap",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: palette.dot,
            boxShadow: passed ? `0 0 12px ${palette.dot}` : "none",
            flex: "0 0 auto",
          }}
        />
        <span>{summary}</span>
      </div>

      <div
        style={{
          marginTop: 5,
          color: "rgba(226,232,240,0.76)",
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        {explanation}
      </div>

      {showClaimStats ? (
        <div
          style={{
            marginTop: 5,
            color: "rgba(226,232,240,0.58)",
            fontSize: 10.5,
            lineHeight: 1.4,
          }}
        >
          {claimStats}
        </div>
      ) : null}
    </div>
  );
}
