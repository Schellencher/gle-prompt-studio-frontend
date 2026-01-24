import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GLE Prompt Studio — GetLaunchEdge Prompt Studio",
  description:
    "GLE Prompt Studio (GetLaunchEdge Prompt Studio) generiert hochwertige Master-Prompts für ChatGPT, Claude, DeepSeek & Co.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#050608",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <div
          style={{
            position: "fixed",
            bottom: 8,
            right: 8,
            zIndex: 99999,
            fontSize: 12,
            background: "rgba(0,0,0,.6)",
            padding: "4px 8px",
            borderRadius: 8,
          }}
        >
          DEPLOY_MARKER_240126_2141
        </div>

        {children}
      </body>
    </html>
  );
}
