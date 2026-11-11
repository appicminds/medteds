"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { JSONContent } from "@tiptap/core";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { sanitizeDoc } from "@/lib/content";
import { requireCan } from "@/lib/session";
import { saveSettings, type SiteSettings } from "@/lib/settings";
import { slugify } from "@/lib/usernames";
import { newId } from "@/lib/utils";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Addresses already used by the app, so a page can't hide them. */
const RESERVED = new Set([
  "admin", "api", "editor", "me", "p", "u", "tag", "topics", "search", "signin", "signup", "settings",
  "write", "reading-list", "design", "invite", "forgot-password", "reset-password", "welcome", "notifications", "library", "list",
  "_next", "favicon.ico", "robots.txt", "sitemap.xml", "feed.xml",
]);

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export async function createPage() {
  const me = await requireCan("managePages", "/admin/pages");
  const id = newId();
  await db.insert(pages).values({ id, slug: `untitled-${id.slice(0, 6)}`, title: "", status: "draft", authorId: me.id });
  redirect(`/admin/pages/${id}`);
}

const pageSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Add a title.").max(120, "Titles can be up to 120 characters."),
  slug: z.string().trim().max(80, "Keep the address under 80 characters."),
  content: z.custom<JSONContent>((v) => typeof v === "object" && v !== null && (v as JSONContent).type === "doc"),
  status: z.enum(["draft", "published"]),
  seoTitle: z.string().trim().max(70, "Search titles can be up to 70 characters.").optional().nullable(),
  seoDescription: z.string().trim().max(160, "Search descriptions can be up to 160 characters.").optional().nullable(),
  noindex: z.boolean().optional(),
});

export type PageInput = z.input<typeof pageSchema>;

export async function savePage(input: PageInput): Promise<ActionResult & { slug?: string }> {
  await requireCan("managePages");
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const existing = await db.query.pages.findFirst({ where: eq(pages.id, d.id) });
  if (!existing) return { ok: false, error: "That page no longer exists." };
  const slug = slugify(d.slug || d.title);
  if (!slug) return { ok: false, error: "Add a web address for the page." };
  if (RESERVED.has(slug)) return { ok: false, error: `“/${slug}” is used by MedTeds itself. Choose another address.` };
  const clash = await db.query.pages.findFirst({ where: and(eq(pages.slug, slug), ne(pages.id, d.id)), columns: { id: true } });
  if (clash) return { ok: false, error: `Another page already uses “/${slug}”.` };
  await db
    .update(pages)
    .set({
      title: d.title,
      slug,
      content: sanitizeDoc(d.content),
      status: d.status,
      seoTitle: d.seoTitle || null,
      seoDescription: d.seoDescription || null,
      noindex: d.noindex ?? existing.noindex,
      updatedAt: new Date(),
    })
    .where(eq(pages.id, d.id));
  revalidatePath(`/${existing.slug}`);
  revalidatePath(`/${slug}`);
  revalidatePath("/admin/pages");
  return { ok: true, slug, message: d.status === "published" ? "Page published." : "Draft saved." };
}

export async function deletePage(id: string) {
  await requireCan("managePages");
  const p = await db.query.pages.findFirst({ where: eq(pages.id, id), columns: { slug: true } });
  await db.delete(pages).where(eq(pages.id, id));
  if (p) revalidatePath(`/${p.slug}`);
  revalidatePath("/admin/pages");
}

/* ------------------------------------------------------------------ */
/* Menus                                                               */
/* ------------------------------------------------------------------ */

const menuItem = z.object({
  label: z.string().trim().min(1, "Every menu item needs a label.").max(40, "Menu labels can be up to 40 characters."),
  url: z
    .string()
    .trim()
    .min(1, "Every menu item needs a link.")
    .max(500)
    .refine((u) => u.startsWith("/") || /^https?:\/\//i.test(u), "Links must start with / or https://"),
});

export async function saveMenus(header: unknown, footer: unknown): Promise<ActionResult> {
  await requireCan("manageMenus");
  const parsed = z.object({ header: z.array(menuItem).max(12), footer: z.array(menuItem).max(20) }).safeParse({ header, footer });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await saveSettings({ headerMenu: parsed.data.header, footerMenu: parsed.data.footer });
  revalidatePath("/", "layout");
  return { ok: true, message: "Menus saved." };
}

/* ------------------------------------------------------------------ */
/* Site settings                                                       */
/* ------------------------------------------------------------------ */

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((u) => !u || /^https?:\/\//i.test(u), "Social links must start with https://");

const settingsSchema = z.object({
  siteName: z.string().trim().min(1, "Enter a site name.").max(40, "Site names can be up to 40 characters."),
  tagline: z.string().trim().max(120, "Taglines can be up to 120 characters."),
  logoUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((u) => !u || u.startsWith("/") || /^https:\/\//i.test(u), "Upload a logo instead of pasting a link."),
  accentColor: z
    .string()
    .trim()
    .refine((c) => !c || /^#[0-9a-f]{6}$/i.test(c), "Pick a colour."),
  social: z.object({ website: optionalUrl, twitter: optionalUrl, linkedin: optionalUrl, instagram: optionalUrl, youtube: optionalUrl }),
  signupOpen: z.boolean(),
  commentApproval: z.enum(["none", "first", "all"]),
});

export type SettingsInput = z.input<typeof settingsSchema>;

export async function saveSiteSettings(input: SettingsInput): Promise<ActionResult> {
  await requireCan("manageSettings");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const patch: Partial<SiteSettings> = {
    ...d,
    logoUrl: d.logoUrl || null,
    accentColor: d.accentColor || null,
  };
  await saveSettings(patch);
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}
