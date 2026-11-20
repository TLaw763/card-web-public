import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";

import { PageContainer } from "@enigmic-co/ui/PageContainer";
import { SkipLink } from "@enigmic-co/ui/SkipLink";

import { AppNav } from "@/components/AppNav";
import { CardToolkitShell } from "@/components/CardToolkitShell";
import { SiteFooter } from "@/components/SiteFooter";
import { COLOR_MODE_BOOTSTRAP } from "@/lib/color-mode";
import { SITE_NAME, siteUrl } from "@/lib/card-seo";
import "@enigmic-co/card-react/styles/tokens.css";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description:
    "Search and browse the Yu-Gi-Oh! card catalog: card text, stats, printings and legality.",
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    // The bootstrap sets data-color-mode on <html> before hydration.
    <html lang="en" data-color-mode="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_MODE_BOOTSTRAP }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <SkipLink />
        <div className="min-h-screen bg-background">
          <AppNav />
          <CardToolkitShell>
            <PageContainer>{children}</PageContainer>
          </CardToolkitShell>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
