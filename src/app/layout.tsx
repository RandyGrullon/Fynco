import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { SITE_URL } from "@/lib/supabase/env";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Fynco", template: "%s · Fynco" },
  description: "Tu cartera personal, tus gastos compartidos y un asistente financiero en un solo lugar.",
  manifest: "/manifest.json",
  applicationName: "Fynco",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Fynco" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Fynco",
    description: "Tu cartera, tus gastos compartidos y tu asistente financiero.",
    url: SITE_URL,
    siteName: "Fynco",
    locale: "es_DO",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Fynco" }],
  },
  twitter: { card: "summary_large_image", title: "Fynco", description: "Tu cartera, tus gastos compartidos y tu asistente financiero.", images: ["/og.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E1013",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`dark ${manrope.variable}`}>
      <body className="min-h-dvh font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
