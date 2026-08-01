"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/gleCore";

type ProofFact = {
  id?: string;
  label: string;
  value: string;
  source?: string;
  version?: number;
};

type Profile = {
  id: string;
  name: string;
  kind: "general" | "brand" | "client" | "project";
  brandName?: string;
  audience?: string;
  voice?: string;
  context?: string;
  proofFacts?: ProofFact[];
  version?: number;
};

type ProfileListResponse = {
  profiles: Profile[];
  used: number;
  limit: number;
};

type ProfileWriteResponse = {
  profile: Profile;
  used: number;
  limit: number;
};

type Draft = {
  id?: string;
  name: string;
  kind: Profile["kind"];
  brandName: string;
  audience: string;
  voice: string;
  context: string;
  proofFacts: ProofFact[];
};

type Props = {
  headers: Record<string, string>;
  language: "de" | "en";
  selectedProfileId: string;
  onSelectProfile: (profileId: string) => void;
  disabled?: boolean;
};

const emptyDraft = (): Draft => ({
  name: "",
  kind: "general",
  brandName: "",
  audience: "",
  voice: "",
  context: "",
  proofFacts: [],
});

function draftFromProfile(profile: Profile): Draft {
  return {
    id: profile.id,
    name: profile.name || "",
    kind: profile.kind || "general",
    brandName: profile.brandName || "",
    audience: profile.audience || "",
    voice: profile.voice || "",
    context: profile.context || "",
    proofFacts: Array.isArray(profile.proofFacts)
      ? profile.proofFacts.map((fact) => ({ ...fact }))
      : [],
  };
}

export default function MagicContextPanel({
  headers,
  language,
  selectedProfileId,
  onSelectProfile,
  disabled = false,
}: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [limit, setLimit] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const t = useMemo(
    () =>
      language === "en"
        ? {
            title: "Magic Context",
            hint: "Use a saved profile as approved context for this generation.",
            none: "No profile",
            manage: "Manage",
            newProfile: "New profile",
            used: "profiles",
            name: "Profile name",
            kind: "Type",
            brand: "Brand / client",
            audience: "Audience",
            voice: "Voice / style",
            context: "Context",
            facts: "Proof Facts",
            addFact: "+ Add fact",
            label: "Label",
            value: "Approved value",
            source: "Source (optional)",
            save: "Save profile",
            cancel: "Cancel",
            delete: "Delete profile",
            deleteConfirm: "Delete this profile permanently?",
            limitReached: "The Studio profile limit has been reached.",
            loadError: "Profiles could not be loaded.",
            saveError: "Profile could not be saved.",
            deleteError: "Profile could not be deleted.",
            active: "Active",
          }
        : {
            title: "Magic Context",
            hint: "Nutze ein gespeichertes Profil als freigegebenen Kontext für diese Generierung.",
            none: "Kein Profil",
            manage: "Verwalten",
            newProfile: "Neues Profil",
            used: "Profile",
            name: "Profilname",
            kind: "Typ",
            brand: "Marke / Kunde",
            audience: "Zielgruppe",
            voice: "Stimme / Stil",
            context: "Kontext",
            facts: "Proof Facts",
            addFact: "+ Fakt hinzufügen",
            label: "Bezeichnung",
            value: "Freigegebener Wert",
            source: "Quelle (optional)",
            save: "Profil speichern",
            cancel: "Abbrechen",
            delete: "Profil löschen",
            deleteConfirm: "Dieses Profil dauerhaft löschen?",
            limitReached: "Das Profil-Limit im Studio ist erreicht.",
            loadError: "Profile konnten nicht geladen werden.",
            saveError: "Profil konnte nicht gespeichert werden.",
            deleteError: "Profil konnte nicht gelöscht werden.",
            active: "Aktiv",
          },
    [language],
  );

  async function refreshProfiles(preferredProfileId?: string) {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<ProfileListResponse>("/api/profiles", headers);
      if (res.ok === false) {
        setProfiles([]);
        setError(("message" in res && typeof res.message === "string" && res.message) || t.loadError);
        return;
      }

      setProfiles(res.profiles || []);
      setLimit(Number(res.limit || 3));

      const candidate = String(preferredProfileId ?? selectedProfileId ?? "").trim();
      if (candidate && !(res.profiles || []).some((p) => p.id === candidate)) {
        onSelectProfile("");
      }
    } catch (e: any) {
      setProfiles([]);
      setError(e?.message || t.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) || null;

  function openNewProfile() {
    if (profiles.length >= limit) {
      setError(t.limitReached);
      return;
    }
    setError("");
    setDraft(emptyDraft());
    setEditorOpen(true);
  }

  function openSelectedProfile() {
    if (!selectedProfile) {
      openNewProfile();
      return;
    }
    setError("");
    setDraft(draftFromProfile(selectedProfile));
    setEditorOpen(true);
  }

  function updateFact(index: number, patch: Partial<ProofFact>) {
    setDraft((prev) => ({
      ...prev,
      proofFacts: prev.proofFacts.map((fact, i) =>
        i === index ? { ...fact, ...patch } : fact,
      ),
    }));
  }

  function addFact() {
    setDraft((prev) => {
      if (prev.proofFacts.length >= 20) return prev;
      return {
        ...prev,
        proofFacts: [...prev.proofFacts, { label: "", value: "", source: "" }],
      };
    });
  }

  function removeFact(index: number) {
    setDraft((prev) => ({
      ...prev,
      proofFacts: prev.proofFacts.filter((_, i) => i !== index),
    }));
  }

  async function saveProfile() {
    if (!draft.name.trim()) {
      setError(language === "en" ? "Profile name is required." : "Profilname fehlt.");
      return;
    }

    const payload = {
      name: draft.name.trim(),
      kind: draft.kind,
      brandName: draft.brandName.trim(),
      audience: draft.audience.trim(),
      voice: draft.voice.trim(),
      context: draft.context.trim(),
      proofFacts: draft.proofFacts
        .filter((fact) => String(fact.value || "").trim())
        .map((fact, index) => ({
          ...(fact.id ? { id: fact.id } : {}),
          label: String(fact.label || "").trim() || `Fact ${index + 1}`,
          value: String(fact.value || "").trim(),
          source: String(fact.source || "").trim(),
        })),
    };

    setSaving(true);
    setError("");
    try {
      const res = draft.id
        ? await apiPut<ProfileWriteResponse>(`/api/profiles/${draft.id}`, payload, headers)
        : await apiPost<ProfileWriteResponse>("/api/profiles", payload, headers);

      if (res.ok === false) {
        setError(("message" in res && typeof res.message === "string" && res.message) || t.saveError);
        return;
      }

      onSelectProfile(res.profile.id);
      setEditorOpen(false);
      await refreshProfiles(res.profile.id);
    } catch (e: any) {
      setError(e?.message || t.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile() {
    if (!draft.id) return;
    if (typeof window !== "undefined" && !window.confirm(t.deleteConfirm)) return;

    setSaving(true);
    setError("");
    try {
      const res = await apiDelete<{ deleted: boolean; profileId: string }>(
        `/api/profiles/${draft.id}`,
        headers,
      );
      if (res.ok === false) {
        setError(("message" in res && typeof res.message === "string" && res.message) || t.deleteError);
        return;
      }

      if (selectedProfileId === draft.id) onSelectProfile("");
      setEditorOpen(false);
      setDraft(emptyDraft());
      await refreshProfiles("");
    } catch (e: any) {
      setError(e?.message || t.deleteError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: 14,
        border: selectedProfile
          ? "1px solid rgba(34, 197, 94, 0.48)"
          : "1px solid rgba(255,255,255,0.10)",
        background: selectedProfile
          ? "rgba(22, 163, 74, 0.08)"
          : "rgba(255,255,255,0.035)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 850, color: "#f4f4f5" }}>
            {t.title}
            {selectedProfile ? (
              <span
                style={{
                  marginLeft: 8,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "rgba(34,197,94,0.18)",
                  color: "#bbf7d0",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {t.active}
              </span>
            ) : null}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#a1a1aa" }}>{t.hint}</div>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          {profiles.length}/{limit} {t.used}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto auto",
          gap: 8,
          marginTop: 12,
          alignItems: "center",
        }}
      >
        <select
          value={selectedProfileId}
          onChange={(e) => onSelectProfile(e.target.value)}
          disabled={disabled || loading}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "#101827",
            color: "#f4f4f5",
            outline: "none",
          }}
        >
          <option value="">{loading ? "…" : t.none}</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name} · v{profile.version || 1} · {profile.proofFacts?.length || 0} Facts
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={openSelectedProfile}
          disabled={disabled || loading}
          style={secondaryButtonStyle}
        >
          {selectedProfile ? t.manage : t.newProfile}
        </button>

        <button
          type="button"
          onClick={openNewProfile}
          disabled={disabled || loading || profiles.length >= limit}
          style={secondaryButtonStyle}
          title={profiles.length >= limit ? t.limitReached : undefined}
        >
          +
        </button>
      </div>

      {selectedProfile ? (
        <div style={{ marginTop: 9, fontSize: 11, color: "#bbf7d0" }}>
          {[selectedProfile.brandName, selectedProfile.audience]
            .filter(Boolean)
            .join(" · ") || selectedProfile.name}
          {selectedProfile.proofFacts?.length
            ? ` · ${selectedProfile.proofFacts.length} Proof Facts`
            : ""}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            marginTop: 10,
            padding: 9,
            borderRadius: 9,
            background: "rgba(239,68,68,0.10)",
            border: "1px solid rgba(239,68,68,0.24)",
            color: "#fecaca",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      {editorOpen ? (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div style={twoColumnStyle}>
            <Field label={t.name}>
              <input
                value={draft.name}
                onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                style={fieldStyle}
                maxLength={80}
              />
            </Field>
            <Field label={t.kind}>
              <select
                value={draft.kind}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, kind: e.target.value as Profile["kind"] }))
                }
                style={fieldStyle}
              >
                <option value="general">General</option>
                <option value="brand">Brand</option>
                <option value="client">Client</option>
                <option value="project">Project</option>
              </select>
            </Field>
            <Field label={t.brand}>
              <input
                value={draft.brandName}
                onChange={(e) => setDraft((p) => ({ ...p, brandName: e.target.value }))}
                style={fieldStyle}
                maxLength={120}
              />
            </Field>
            <Field label={t.voice}>
              <input
                value={draft.voice}
                onChange={(e) => setDraft((p) => ({ ...p, voice: e.target.value }))}
                style={fieldStyle}
                maxLength={500}
              />
            </Field>
          </div>

          <Field label={t.audience}>
            <textarea
              value={draft.audience}
              onChange={(e) => setDraft((p) => ({ ...p, audience: e.target.value }))}
              rows={2}
              style={fieldStyle}
              maxLength={1000}
            />
          </Field>

          <Field label={t.context}>
            <textarea
              value={draft.context}
              onChange={(e) => setDraft((p) => ({ ...p, context: e.target.value }))}
              rows={3}
              style={fieldStyle}
              maxLength={4000}
            />
          </Field>

          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "#d4d4d8" }}>
                {t.facts} ({draft.proofFacts.length}/20)
              </div>
              <button
                type="button"
                onClick={addFact}
                disabled={draft.proofFacts.length >= 20 || saving}
                style={secondaryButtonStyle}
              >
                {t.addFact}
              </button>
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {draft.proofFacts.map((fact, index) => (
                <div
                  key={fact.id || `new-${index}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(120px, .7fr) minmax(160px, 1.2fr) minmax(120px, .8fr) auto",
                    gap: 7,
                    alignItems: "center",
                  }}
                >
                  <input
                    value={fact.label}
                    onChange={(e) => updateFact(index, { label: e.target.value })}
                    placeholder={t.label}
                    style={fieldStyle}
                    maxLength={80}
                  />
                  <input
                    value={fact.value}
                    onChange={(e) => updateFact(index, { value: e.target.value })}
                    placeholder={t.value}
                    style={fieldStyle}
                    maxLength={500}
                  />
                  <input
                    value={fact.source || ""}
                    onChange={(e) => updateFact(index, { source: e.target.value })}
                    placeholder={t.source}
                    style={fieldStyle}
                    maxLength={300}
                  />
                  <button
                    type="button"
                    onClick={() => removeFact(index)}
                    style={iconButtonStyle}
                    aria-label="Remove fact"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button type="button" onClick={saveProfile} disabled={saving} style={primaryButtonStyle}>
              {saving ? "…" : t.save}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditorOpen(false);
                setError("");
              }}
              disabled={saving}
              style={secondaryButtonStyle}
            >
              {t.cancel}
            </button>
            {draft.id ? (
              <button
                type="button"
                onClick={deleteProfile}
                disabled={saving}
                style={dangerButtonStyle}
              >
                {t.delete}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginTop: 10 }}>
      <div style={{ marginBottom: 5, fontSize: 11, fontWeight: 700, color: "#a1a1aa" }}>
        {label}
      </div>
      {children}
    </label>
  );
}

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 8,
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.22)",
  color: "#f4f4f5",
  outline: "none",
  fontSize: 12,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(34,197,94,0.55)",
  background: "rgba(22,163,74,0.18)",
  color: "#bbf7d0",
  padding: "8px 11px",
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#d4d4d8",
  padding: "8px 10px",
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  border: "1px solid rgba(239,68,68,0.35)",
  color: "#fecaca",
};

const iconButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  minWidth: 34,
  padding: "7px 9px",
  fontSize: 16,
  lineHeight: 1,
};
