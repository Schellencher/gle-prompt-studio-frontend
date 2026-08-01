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
  approvedFactIds?: string[];
  factVersions?: Array<{ id?: string; version?: number }>;
  worldTruthVerified?: boolean;
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

export default function ProofStatusBadge({ proof, language }: Props) {
  const isEn = language === "en";
  const status = String(proof?.status || "NOT_VERIFIED").toUpperCase();
  const passed = status === "PASSED";
  const review = status === "REVIEW_REQUIRED" || status === "REVIEW REQUIRED";
  const blocked = status === "BLOCKED";
  const factCount = Math.max(0, Number(proof?.factCount || 0));
  const profileVersion = Number(proof?.profileVersion || 0);

  const palette = passed
    ? {
        border: "rgba(34,197,94,0.62)",
        bg: "rgba(22,163,74,0.14)",
        text: "#bbf7d0",
        dot: "#22c55e",
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
    : review
      ? "REVIEW REQUIRED"
      : blocked
        ? "BLOCKED"
        : "NOT VERIFIED";

  const countLabel = passed && factCount > 0 ? `${factCount}/${factCount} Proof Facts` : factCount > 0 ? `${factCount} Proof Facts` : "";
  const versionLabel = profileVersion > 0 ? `${isEn ? "Profile" : "Profil"} v${profileVersion}` : "";
  const summary = [statusLabel, countLabel, versionLabel].filter(Boolean).join(" · ");
  const knownReason = proof?.reason ? reasonText[String(proof.reason)] : undefined;

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
          color: "rgba(226,232,240,0.72)",
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        {passed
          ? isEn
            ? "Checked against the approved facts in the selected profile. This does not verify external world truth."
            : "Gegen die freigegebenen Fakten im ausgewählten Profil geprüft. Dies bestätigt keine externe Weltwahrheit."
          : knownReason
            ? isEn
              ? knownReason.en
              : knownReason.de
            : isEn
              ? "This output has not been verified by GLE Proof-of-Execution."
              : "Diese Ausgabe wurde noch nicht durch GLE Proof-of-Execution verifiziert."}
      </div>
    </div>
  );
}
