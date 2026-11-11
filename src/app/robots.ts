import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSettings();
  if (!settings.searchVisible) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/media/"],
      disallow: ["/admin", "/editor", "/write", "/me", "/settings", "/api/", "/reading-list", "/search", "/invite", "/reset-password"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
