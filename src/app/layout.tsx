import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { TopBar } from "@/components/blog/top-bar";
import { SiteFooter } from "@/components/blog/site-footer";
import { themeScript } from "@/components/blog/theme-toggle";
import { getSettings } from "@/lib/settings";
import { robotsFor, shareImages, siteOrigin, twitterCard } from "@/lib/seo";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], style: ["normal", "italic"] });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const title = s.homeSeoTitle || (s.tagline ? `${s.siteName}: ${s.tagline}` : s.siteName);
  const description = s.homeSeoDescription || s.tagline || undefined;
  return {
    title: { default: title, template: `%s ${s.titleSeparator} ${s.siteName}` },
    description,
    metadataBase: new URL(siteOrigin()),
    applicationName: s.siteName,
    icons: s.logoUrl ? { icon: s.logoUrl } : undefined,
    robots: robotsFor(s),
    alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: `${s.siteName} stories` }] } },
    openGraph: { siteName: s.siteName, type: "website", title, description, images: shareImages(s) },
    twitter: twitterCard(s, { title, description }),
    verification: s.googleVerification ? { google: s.googleVerification } : undefined,
  };
}

/** Text colour that reads on top of a custom brand colour. */
function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1b1007" : "#ffffff";
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const s = await getSettings();
  const accent = s.accentColor && /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : null;
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint (pattern from the Next.js "preventing flash" guide). */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        {accent ? (
          // The brand colour from Admin → Settings overrides the design default in both themes.
          <style>{`:root{--accent:${accent}!important;--accent-fg:${readableOn(accent)}!important;--accent-soft:color-mix(in srgb,${accent} 14%,var(--bg))!important;--ring:color-mix(in srgb,${accent} 40%,transparent)!important}`}</style>
        ) : null}
      </head>
      <body className="flex min-h-dvh flex-col">
        <TopBar />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
