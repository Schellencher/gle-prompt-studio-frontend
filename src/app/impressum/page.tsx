import type { CSSProperties } from "react";

export default function ImpressumPage() {
  return (
    <main style={page}>
      <h1>Impressum</h1>

      <p>Angaben gemäß § 5 DDG</p>

      <h2>Anbieter</h2>
      <p>
        GetLaunchEdge / GLE Prompt Studio<br />
        Marcel Scheller<br />
        Bruno-Wille-Str. 24<br />
        12587 Berlin<br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail:{" "}
        <a href="mailto:support@getlaunchedge.com">
          support@getlaunchedge.com
        </a>
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p>
        Marcel Scheller<br />
        Bruno-Wille-Str. 24<br />
        12587 Berlin
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
