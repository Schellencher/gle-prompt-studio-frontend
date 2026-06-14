import type { CSSProperties } from "react";

export default function DatenschutzPage() {
  return (
    <main style={page}>
      <h1>Datenschutzerklärung</h1>

      <p>
        Diese Datenschutzerklärung informiert darüber, wie personenbezogene Daten bei der Nutzung von GLE Prompt Studio verarbeitet werden.
      </p>

      <h2>1. Verantwortlicher</h2>
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

      <h2>2. Verarbeitete Daten</h2>
      <p>Bei der Nutzung der App können insbesondere folgende Daten verarbeitet werden:</p>
      <ul>
        <li>Account-ID und User-ID</li>
        <li>Planstatus, Nutzungslimits und Zählerstände</li>
        <li>eingegebene Themen, Prompts und Zusatzangaben</li>
        <li>technische Verbindungsdaten</li>
        <li>bei PRO-Nutzung Zahlungs- und Abo-Informationen über Stripe</li>
        <li>optional eingegebene OpenAI API Keys bei BYOK-Nutzung</li>
      </ul>

      <h2>3. Zwecke der Verarbeitung</h2>
      <p>
        Die Daten werden verarbeitet, um die App bereitzustellen, Prompts zu generieren,
        Nutzungslimits zu verwalten, PRO-Funktionen bereitzustellen, Zahlungen abzuwickeln
        und technischen Support leisten zu können.
      </p>

      <h2>4. Rechtsgrundlagen</h2>
      <p>
        Die Verarbeitung erfolgt je nach Fall zur Vertragserfüllung, zur Durchführung vorvertraglicher Maßnahmen,
        aufgrund berechtigter Interessen an einem sicheren und funktionsfähigen Betrieb der App oder aufgrund einer Einwilligung.
      </p>

      <h2>5. Hosting und technische Dienstleister</h2>
      <p>
        Die App wird über technische Dienstleister betrieben, insbesondere Vercel für das Frontend
        und Render für das Backend. Dabei können technische Verbindungsdaten verarbeitet werden.
      </p>

      <h2>6. KI-Verarbeitung / OpenAI</h2>
      <p>
        Zur Generierung von Inhalten kann GLE Prompt Studio Schnittstellen von OpenAI nutzen.
        Eingegebene Themen, Prompts und Zusatzinformationen können zur Verarbeitung an OpenAI übermittelt werden.
        Bei BYOK-Nutzung wird ein vom Nutzer bereitgestellter OpenAI API Key verwendet.
      </p>

      <h2>7. Zahlungen / Stripe</h2>
      <p>
        Für PRO-Abonnements kann Stripe als Zahlungsdienstleister eingesetzt werden.
        Zahlungsdaten werden direkt durch Stripe verarbeitet. GLE Prompt Studio speichert hierzu insbesondere Informationen,
        die zur Zuordnung des Abonnements und des Planstatus erforderlich sind.
      </p>

      <h2>8. Speicherdauer</h2>
      <p>
        Personenbezogene Daten werden nur so lange gespeichert, wie es für die genannten Zwecke erforderlich ist
        oder gesetzliche Aufbewahrungspflichten bestehen.
      </p>

      <h2>9. Rechte der betroffenen Personen</h2>
      <p>
        Nutzer haben nach Maßgabe der gesetzlichen Vorschriften insbesondere Rechte auf Auskunft,
        Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch.
        Außerdem besteht ein Beschwerderecht bei einer zuständigen Datenschutzaufsichtsbehörde.
      </p>

      <h2>10. Kontakt</h2>
      <p>
        Fragen zum Datenschutz können an folgende E-Mail-Adresse gesendet werden:<br />
        <a href="mailto:support@getlaunchedge.com">
          support@getlaunchedge.com
        </a>
      </p>

      <p style={{ opacity: 0.75, marginTop: 28 }}>Stand: Juni 2026</p>

      <p>
        <a href="/">Zurück zur App</a>
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
