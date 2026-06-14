import type { CSSProperties } from "react";

export default function DatenschutzPage() {
  return (
    <main style={page}>
      <h1>Datenschutzerklärung / Privacy Policy</h1>

      <section>
        <h2>Deutsch</h2>

        <p>
          Diese Datenschutzerklärung informiert darüber, wie personenbezogene Daten bei der Nutzung von GLE Prompt Studio verarbeitet werden.
        </p>

        <h3>1. Verantwortlicher</h3>
        <p>
          Marcel Scheller<br />
          GetLaunchEdge / GLE Prompt Studio<br />
          Bruno-Wille-Str. 24<br />
          12587 Berlin<br />
          Deutschland<br />
          E-Mail:{" "}
          <a href="mailto:support@getlaunchedge.com">
            support@getlaunchedge.com
          </a>
        </p>

        <h3>2. Verarbeitete Daten</h3>
        <p>Bei der Nutzung der App können insbesondere folgende Daten verarbeitet werden:</p>
        <ul>
          <li>Account-ID und User-ID</li>
          <li>Planstatus, Nutzungslimits und Zählerstände</li>
          <li>eingegebene Themen, Prompts und Zusatzangaben</li>
          <li>technische Verbindungsdaten</li>
          <li>bei PRO-Nutzung Zahlungs- und Abo-Informationen über Stripe</li>
          <li>optional eingegebene OpenAI API Keys bei BYOK-Nutzung</li>
        </ul>

        <h3>3. Zwecke der Verarbeitung</h3>
        <p>
          Die Daten werden verarbeitet, um die App bereitzustellen, Prompts zu generieren,
          Nutzungslimits zu verwalten, PRO-Funktionen bereitzustellen, Zahlungen abzuwickeln
          und technischen Support leisten zu können.
        </p>

        <h3>4. Rechtsgrundlagen</h3>
        <p>
          Die Verarbeitung erfolgt je nach Fall zur Vertragserfüllung, zur Durchführung vorvertraglicher Maßnahmen,
          aufgrund berechtigter Interessen an einem sicheren und funktionsfähigen Betrieb der App oder aufgrund einer Einwilligung.
        </p>

        <h3>5. Hosting und technische Dienstleister</h3>
        <p>
          Die App wird über technische Dienstleister betrieben, insbesondere Vercel für das Frontend
          und Render für das Backend. Dabei können technische Verbindungsdaten verarbeitet werden.
        </p>

        <h3>6. KI-Verarbeitung / OpenAI</h3>
        <p>
          Zur Generierung von Inhalten kann GLE Prompt Studio Schnittstellen von OpenAI nutzen.
          Eingegebene Themen, Prompts und Zusatzinformationen können zur Verarbeitung an OpenAI übermittelt werden.
          Bei BYOK-Nutzung wird ein vom Nutzer bereitgestellter OpenAI API Key verwendet.
        </p>

        <h3>7. Zahlungen / Stripe</h3>
        <p>
          Für PRO-Abonnements kann Stripe als Zahlungsdienstleister eingesetzt werden.
          Zahlungsdaten werden direkt durch Stripe verarbeitet. GLE Prompt Studio speichert hierzu insbesondere Informationen,
          die zur Zuordnung des Abonnements und des Planstatus erforderlich sind.
        </p>

        <h3>8. Speicherdauer</h3>
        <p>
          Personenbezogene Daten werden nur so lange gespeichert, wie es für die genannten Zwecke erforderlich ist
          oder gesetzliche Aufbewahrungspflichten bestehen.
        </p>

        <h3>9. Rechte der betroffenen Personen</h3>
        <p>
          Nutzer haben nach Maßgabe der gesetzlichen Vorschriften insbesondere Rechte auf Auskunft,
          Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch.
          Außerdem besteht ein Beschwerderecht bei einer zuständigen Datenschutzaufsichtsbehörde.
        </p>

        <h3>10. Kontakt</h3>
        <p>
          Fragen zum Datenschutz können an folgende E-Mail-Adresse gesendet werden:<br />
          <a href="mailto:support@getlaunchedge.com">
            support@getlaunchedge.com
          </a>
        </p>
      </section>

      <hr style={divider} />

      <section>
        <h2>English</h2>

        <p>
          This privacy policy explains how personal data may be processed when using GLE Prompt Studio.
        </p>

        <h3>1. Controller</h3>
        <p>
          Marcel Scheller<br />
          GetLaunchEdge / GLE Prompt Studio<br />
          Bruno-Wille-Str. 24<br />
          12587 Berlin<br />
          Germany<br />
          Email:{" "}
          <a href="mailto:support@getlaunchedge.com">
            support@getlaunchedge.com
          </a>
        </p>

        <h3>2. Data processed</h3>
        <p>When using the app, the following data may be processed in particular:</p>
        <ul>
          <li>Account ID and User ID</li>
          <li>plan status, usage limits and usage counters</li>
          <li>topics, prompts and additional details entered by the user</li>
          <li>technical connection data</li>
          <li>payment and subscription information via Stripe for PRO usage</li>
          <li>optionally entered OpenAI API keys for BYOK usage</li>
        </ul>

        <h3>3. Purposes of processing</h3>
        <p>
          The data is processed to provide the app, generate prompts, manage usage limits,
          provide PRO features, process payments and provide technical support.
        </p>

        <h3>4. Legal bases</h3>
        <p>
          Depending on the specific case, processing is based on contract performance,
          pre-contractual measures, legitimate interests in secure and functional app operation,
          or user consent.
        </p>

        <h3>5. Hosting and technical service providers</h3>
        <p>
          The app is operated using technical service providers, in particular Vercel for the frontend
          and Render for the backend. Technical connection data may be processed in this context.
        </p>

        <h3>6. AI processing / OpenAI</h3>
        <p>
          GLE Prompt Studio may use OpenAI interfaces to generate content.
          Topics, prompts and additional information entered by the user may be transmitted to OpenAI for processing.
          When BYOK is used, an OpenAI API key provided by the user is used.
        </p>

        <h3>7. Payments / Stripe</h3>
        <p>
          Stripe may be used as a payment provider for PRO subscriptions.
          Payment data is processed directly by Stripe. GLE Prompt Studio stores information required
          to assign the subscription and plan status.
        </p>

        <h3>8. Storage period</h3>
        <p>
          Personal data is stored only as long as necessary for the stated purposes
          or as required by statutory retention obligations.
        </p>

        <h3>9. Rights of data subjects</h3>
        <p>
          Users may have statutory rights to access, rectification, deletion, restriction of processing,
          data portability and objection. Users may also have the right to lodge a complaint
          with a competent data protection supervisory authority.
        </p>

        <h3>10. Contact</h3>
        <p>
          Questions about privacy can be sent to:<br />
          <a href="mailto:support@getlaunchedge.com">
            support@getlaunchedge.com
          </a>
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
  maxWidth: 900,
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
