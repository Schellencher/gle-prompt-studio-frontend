import type { CSSProperties } from "react";

export default function SupportPage() {
  return (
    <main style={page}>
      <h1>Support</h1>

      <p>
        Bei Fragen zu GLE Prompt Studio erreichst du den Support per E-Mail.
      </p>

      <p>
        E-Mail:{" "}
        <a href="mailto:support@getlaunchedge.com">
          support@getlaunchedge.com
        </a>
      </p>

      <h2>Wichtig bei Support-Anfragen</h2>
      <p>
        Bitte sende bei technischen Problemen möglichst deine Account-ID oder User-ID mit.
        Sende niemals deinen OpenAI API Key, Stripe-Daten oder Passwörter per E-Mail.
      </p>

      <p style={{ opacity: 0.75, marginTop: 28 }}>Stand: Juni 2026</p>

      <p>
        <a href="/">Zurück zur App</a>
      </p>
    </main>
  );
}

const page: CSSProperties = {
  maxWidth: 820,
  margin: "40px auto",
  padding: 24,
  fontFamily: "system-ui, sans-serif",
  lineHeight: 1.6,
};
