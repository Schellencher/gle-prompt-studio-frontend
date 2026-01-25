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
      <body>{children}</body>
    </html>
  );
}
