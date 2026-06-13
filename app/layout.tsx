import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moody — votre trajet selon votre humeur",
  description:
    "Moody génère des itinéraires parisiens ultra-personnalisés selon votre mood : pressé, zen, sportif, flâneur ou économe. Métro, Vélib et marche, combinés pour vous.",
  applicationName: "Moody",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png" }],
  },
  appleWebApp: { capable: true, title: "Moody", statusBarStyle: "default" },
  openGraph: {
    title: "Moody — votre trajet selon votre humeur",
    description:
      "Des itinéraires parisiens qui s'adaptent à votre humeur. Métro + Vélib + marche.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f5f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
