import type { CSSProperties } from "react";

export default function ImpressumPage() {
  return (
    <main style={page}>
      <h1>Impressum / Legal Notice</h1>

      <section>
        <h2>Deutsch</h2>

        <p>Angaben gemäß § 5 DDG</p>

        <h3>Anbieter</h3>
        <p>
          GetLaunchEdge / GLE Prompt Studio<br />
          Marcel Scheller<br />
          Bruno-Wille-Str. 24<br />
          12587 Berlin<br />
          Deutschland
        </p>

        <h3>Kontakt</h3>
        <p>
          E-Mail:{" "}
          <a href="mailto:support@getlaunchedge.com">
            support@getlaunchedge.com
          </a>
        </p>

        <h3>Verantwortlich für den Inhalt</h3>
        <p>
          Marcel Scheller<br />
          Bruno-Wille-Str. 24<br />
          12587 Berlin
        </p>
      </section>

      <hr style={divider} />

      <section>
        <h2>English</h2>

        <p>Information according to Section 5 DDG</p>

        <h3>Provider</h3>
        <p>
          GetLaunchEdge / GLE Prompt Studio<br />
          Marcel Scheller<br />
          Bruno-Wille-Str. 24<br />
          12587 Berlin<br />
          Germany
        </p>

        <h3>Contact</h3>
        <p>
          Email:{" "}
          <a href="mailto:support@getlaunchedge.com">
            support@getlaunchedge.com
          </a>
        </p>

        <h3>Responsible for content</h3>
        <p>
          Marcel Scheller<br />
          Bruno-Wille-Str. 24<br />
          12587 Berlin<br />
          Germany
        </p>
      </section>

      <p style={{ opacity: 0.75, marginTop: 28 }}>Stand / Last updated: Juni 2026</p>

      <p>
        <a href="/">Zurück zur App / Back to app</a>
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

const divider: CSSProperties = {
  margin: "32px 0",
  border: "none",
  borderTop: "1px solid #ddd",
};
