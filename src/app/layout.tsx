import type { Metadata, Viewport } from "next";
import "./globals.css";
import MaintenanceBanner from "../components/MaintenanceBanner";

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
  const maintenanceEnabled =
    String(process.env.MAINTENANCE_MODE || "").trim() === "1";

  return (
    <html lang="de">
      <body>
        <MaintenanceBanner enabled={maintenanceEnabled} />
        {children}
      </body>
    </html>
  );
}
