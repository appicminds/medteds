import type { Metadata } from "next";
import type { SiteSettings } from "@/lib/settings";

/** The site's public address, without a trailing slash. */
export function siteOrigin() {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return fromEnv.replace(/\/+$/, "");
}

/** Turns a path like "/p/slug" or "/api/media/x" into a full address. Full addresses pass through. */
export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteOrigin()}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Canonical address for a page, keeping the site's RSS link (child metadata replaces the parent's alternates). */
export function alternatesFor(path: string, canonical?: string | null): Metadata["alternates"] {
  return { canonical: canonical || path, types: { "application/rss+xml": "/feed.xml" } };
}

/** Robots rules for a page: hidden when the page asks for it or the whole site is hidden. */
export function robotsFor(settings: SiteSettings, noindex = false): Metadata["robots"] {
  return !settings.searchVisible || noindex ? { index: false, follow: true } : { index: true, follow: true };
}

/** Sharing images for a page, falling back to the site's default sharing image. */
export function shareImages(settings: SiteSettings, image?: string | null) {
  const src = image || settings.defaultShareImage;
  return src ? [src] : undefined;
}

/** Twitter (X) card details shared by every page. */
export function twitterCard(settings: SiteSettings, opts: { title?: string; description?: string; image?: string | null } = {}): Metadata["twitter"] {
  const images = shareImages(settings, opts.image);
  const handle = settings.twitterHandle ? `@${settings.twitterHandle}` : undefined;
  return {
    card: images ? "summary_large_image" : "summary",
    title: opts.title,
    description: opts.description,
    images,
    site: handle,
  };
}

/** Serialises JSON-LD safely for a <script> tag. */
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
