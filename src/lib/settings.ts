import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type MenuItem = { label: string; url: string };

export type SiteSettings = {
  siteName: string;
  tagline: string;
  logoUrl: string | null;
  accentColor: string | null; // hex; null keeps the design default
  social: { website: string; twitter: string; linkedin: string; instagram: string; youtube: string };
  headerMenu: MenuItem[];
  footerMenu: MenuItem[];
  signupOpen: boolean;
  commentApproval: "none" | "first" | "all";
};

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "MedTeds",
  tagline: "Ideas in medicine, told well",
  logoUrl: null,
  accentColor: null,
  social: { website: "", twitter: "", linkedin: "", instagram: "", youtube: "" },
  headerMenu: [],
  footerMenu: [
    { label: "About", url: "/about" },
    { label: "Topics", url: "/topics" },
    { label: "Privacy", url: "/privacy" },
    { label: "Terms", url: "/terms" },
  ],
  signupOpen: true,
  commentApproval: "first",
};

/** Site settings for this request, with defaults filled in. */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "site") });
  const saved = (row?.value ?? {}) as Partial<SiteSettings>;
  return { ...DEFAULT_SETTINGS, ...saved, social: { ...DEFAULT_SETTINGS.social, ...(saved.social ?? {}) } };
});

export async function saveSettings(patch: Partial<SiteSettings>) {
  const current = await getSettings();
  const value = { ...current, ...patch };
  await db
    .insert(settings)
    .values({ key: "site", value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  return value;
}
