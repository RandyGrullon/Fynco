import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { IntroSplash, introSkipScript } from "@/components/intro-splash";
import { AppViewport } from "@/components/app-viewport";
import { SITE_URL } from "@/lib/supabase/env";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Fynco", template: "%s · Fynco" },
  description: "Tu plan de finanzas y un asistente honesto que registra y recuerda todo.",
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
    description: "Tu plan de finanzas y un asistente honesto.",
    url: SITE_URL,
    siteName: "Fynco",
    locale: "es_DO",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Fynco" }],
  },
  twitter: { card: "summary_large_image", title: "Fynco", description: "Tu plan de finanzas y un asistente honesto.", images: ["/og.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Como app: sin zoom (tampoco al tocar un campo) y el teclado achica la pantalla en vez de taparla.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0E1013",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: el script de <head> puede marcar data-intro antes de hidratar.
    <html lang="es" className={`dark ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introSkipScript }} />
      </head>
      <body className="font-sans">
        <IntroSplash />
        <AppViewport />
        <div className="app-raiz">
          <QueryProvider>{children}</QueryProvider>
        </div>
      </body>
    </html>
  );
}
