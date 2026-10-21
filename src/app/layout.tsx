import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AchievementToasts } from "@/components/achievement-toasts";
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
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — Free Browser Games, No Signup`,
    description: site.description,
  },
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
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        {/* Mounted before page content so its event listener is attached
            before any on-mount unlocks (e.g. RecentTracker) dispatch. */}
        <AchievementToasts />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
