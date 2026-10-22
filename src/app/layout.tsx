import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AchievementToasts } from "@/components/achievement-toasts";
import { Celebrations } from "@/components/celebrations";
import { JsonLd } from "@/components/json-ld";
import { KonamiListener } from "@/components/konami";
import { OfflineBanner } from "@/components/offline-banner";
import { ServiceWorkerRegister } from "@/components/pwa";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/lib/catalog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Free Browser Games, No Signup`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  keywords: [
    "browser games",
    "free online games",
    "html5 games",
    "arcade games",
    "puzzle games",
    "no signup games",
    "play instantly",
  ],
  openGraph: {
    title: `${site.name} — Free Browser Games, No Signup`,
    description: site.description,
    url: site.url,
    siteName: site.name,
    type: "website",
    images: [
      {
        url: `${site.url}/og.png`,
        width: 1200,
        height: 630,
        alt: "Talhacade — 160 free browser games, no signup",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — Free Browser Games, No Signup`,
    description: site.description,
    images: [`${site.url}/og.png`],
  },
};

/** Site-wide structured data — WebSite (with search) + publisher org. */
const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: site.name,
      url: site.url,
      description: site.description,
      inLanguage: "en",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${site.url}/games/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      name: site.name,
      url: site.url,
      logo: `${site.url}/icon.svg`,
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#07070e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable} h-full antialiased`}
    >
      {/* Explicit base path: relative manifest URLs break on deep pages and
          under the GitHub Pages /talhacade/ prefix. React hoists <link> to head. */}
      <link
        rel="manifest"
        href={`${process.env.NEXT_PUBLIC_BASE_PATH}/manifest.webmanifest`}
      />
      <body className="flex min-h-screen flex-col">
        <JsonLd data={siteGraph} />
        <ServiceWorkerRegister />
        <SiteHeader />
        {/* Mounted before page content so its event listener is attached
            before any on-mount unlocks (e.g. RecentTracker) dispatch. */}
        <AchievementToasts />
        <Celebrations />
        <KonamiListener />
        <OfflineBanner />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
