import type { CSSProperties } from "react";

export default function SupportPage() {
  return (
    <main style={page}>
      <h1>Support</h1>

      <section>
        <h2>Deutsch</h2>

        <p>
          Bei Fragen zu GLE Prompt Studio erreichst du den Support per E-Mail.
        </p>

        <p>
          E-Mail:{" "}
          <a href="mailto:support@getlaunchedge.com">
            support@getlaunchedge.com
          </a>
        </p>

        <h3>Wichtig bei Support-Anfragen</h3>
        <p>
          Bitte sende bei technischen Problemen möglichst deine Account-ID oder User-ID mit.
          Sende niemals deinen OpenAI API Key, Stripe-Daten oder Passwörter per E-Mail.
        </p>
      </section>

      <hr style={divider} />

      <section>
        <h2>English</h2>

        <p>
          If you have questions about GLE Prompt Studio, you can contact support by email.
        </p>

        <p>
          Email:{" "}
          <a href="mailto:support@getlaunchedge.com">
            support@getlaunchedge.com
          </a>
        </p>

        <h3>Important for support requests</h3>
        <p>
          For technical issues, please include your Account ID or User ID if possible.
          Never send your OpenAI API key, Stripe data, or passwords by email.
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
