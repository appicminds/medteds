"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pages, posts, topics } from "@/db/schema";
import { requireCan } from "@/lib/session";
import { saveSettings } from "@/lib/settings";
import { slugify } from "@/lib/usernames";

export type SeoResult = { ok: true; message: string; slug?: string } | { ok: false; error: string };

const text = (max: number, what: string) => z.string().trim().max(max, `${what} can be up to ${max} characters.`);
const imageUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((u) => !u || u.startsWith("/") || /^https:\/\//i.test(u), "Choose an image from the media library.");

const storySeoSchema = z.object({
  slug: text(120, "Web addresses"),
  seoTitle: text(70, "Search titles"),
  seoDescription: text(160, "Search descriptions"),
  noindex: z.boolean(),
  canonicalUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "The original address must start with http:// or https://."),
  shareImage: imageUrl,
});

export type StorySeoInput = z.input<typeof storySeoSchema>;

function refreshAll(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/admin/seo");
  revalidatePath("/sitemap.xml");
}

async function uniquePostSlug(wanted: string, postId: string) {
  const base = slugify(wanted) || "story";
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const clash = await db.query.posts.findFirst({ where: and(eq(posts.slug, candidate), ne(posts.id, postId)), columns: { id: true } });
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${postId.slice(0, 6)}`;
}

/** Saves only the SEO fields of a story. Never touches its text, status or author. */
export async function saveStorySeo(id: string, input: StorySeoInput): Promise<SeoResult> {
  await requireCan("manageSeo", "/admin/seo");
  const parsed = storySeoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const post = await db.query.posts.findFirst({ where: eq(posts.id, id), columns: { id: true, slug: true } });
  if (!post) return { ok: false, error: "That story no longer exists." };
  let slug = post.slug;
  if (d.slug && !post.slug.startsWith("draft-")) {
    const wanted = slugify(d.slug);
    if (wanted && wanted !== post.slug) slug = await uniquePostSlug(wanted, post.id);
  }
  await db
    .update(posts)
    .set({
      slug,
      seoTitle: d.seoTitle || null,
      seoDescription: d.seoDescription || null,
      noindex: d.noindex,
      canonicalUrl: d.canonicalUrl || null,
      shareImage: d.shareImage || null,
    })
    .where(eq(posts.id, id));
  refreshAll(`/p/${post.slug}`, `/p/${slug}`, "/feed.xml");
  return { ok: true, message: "SEO saved.", slug };
}

const pageSeoSchema = z.object({
  seoTitle: text(70, "Search titles"),
  seoDescription: text(160, "Search descriptions"),
  noindex: z.boolean(),
});

export async function savePageSeo(id: string, input: z.input<typeof pageSeoSchema>): Promise<SeoResult> {
  await requireCan("manageSeo", "/admin/seo");
  const parsed = pageSeoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const page = await db.query.pages.findFirst({ where: eq(pages.id, id), columns: { slug: true } });
  if (!page) return { ok: false, error: "That page no longer exists." };
  const d = parsed.data;
  await db.update(pages).set({ seoTitle: d.seoTitle || null, seoDescription: d.seoDescription || null, noindex: d.noindex }).where(eq(pages.id, id));
  refreshAll(`/${page.slug}`);
  return { ok: true, message: "SEO saved." };
}

const topicSeoSchema = z.object({
  seoTitle: text(70, "Search titles"),
  seoDescription: text(160, "Search descriptions"),
});

export async function saveTopicSeo(id: number, input: z.input<typeof topicSeoSchema>): Promise<SeoResult> {
  await requireCan("manageSeo", "/admin/seo");
  const parsed = topicSeoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const topic = await db.query.topics.findFirst({ where: eq(topics.id, id), columns: { slug: true } });
  if (!topic) return { ok: false, error: "That topic no longer exists." };
  await db.update(topics).set({ seoTitle: parsed.data.seoTitle || null, seoDescription: parsed.data.seoDescription || null }).where(eq(topics.id, id));
  refreshAll(`/tag/${topic.slug}`);
  return { ok: true, message: "SEO saved." };
}

const siteSeoSchema = z.object({
  homeSeoTitle: text(70, "Search titles"),
  homeSeoDescription: text(160, "Search descriptions"),
  titleSeparator: z.enum(["·", "|", "–", "-", "—", ":"]),
  searchVisible: z.boolean(),
  defaultShareImage: imageUrl,
  twitterHandle: z
    .string()
    .trim()
    .transform((h) => h.replace(/^@/, ""))
    .refine((h) => !h || /^[A-Za-z0-9_]{1,15}$/.test(h), "X handles use up to 15 letters, numbers and underscores."),
  googleVerification: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v.match(/content=["']([^"']+)["']/)?.[1] ?? v)
    .refine((v) => !v || /^[A-Za-z0-9_-]+$/.test(v), "Paste the code from Google Search Console, or the whole meta tag."),
});

export type SiteSeoInput = z.input<typeof siteSeoSchema>;

export async function saveSiteSeo(input: SiteSeoInput): Promise<SeoResult> {
  await requireCan("manageSeo", "/admin/seo");
  const parsed = siteSeoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await saveSettings({ ...parsed.data, defaultShareImage: parsed.data.defaultShareImage || null });
  revalidatePath("/", "layout");
  return { ok: true, message: "Site SEO saved." };
}

export type BulkSeoAction = "reset" | "hide" | "show";

/** Bulk changes for stories or pages from Admin → SEO. */
export async function bulkSeo(kind: "stories" | "pages", ids: string[], action: BulkSeoAction): Promise<SeoResult> {
  await requireCan("manageSeo", "/admin/seo");
  if (!ids.length) return { ok: false, error: "Select at least one row." };
  const n = ids.length;
  const label = `${n} ${kind === "stories" ? (n === 1 ? "story" : "stories") : n === 1 ? "page" : "pages"}`;
  if (kind === "stories") {
    const set =
      action === "reset"
        ? { seoTitle: null, seoDescription: null, shareImage: null }
        : { noindex: action === "hide" };
    await db.update(posts).set(set).where(inArray(posts.id, ids));
  } else {
    const set = action === "reset" ? { seoTitle: null, seoDescription: null } : { noindex: action === "hide" };
    await db.update(pages).set(set).where(inArray(pages.id, ids));
  }
  revalidatePath("/", "layout");
  return {
    ok: true,
    message:
      action === "reset" ? `${label} reset to automatic SEO.` : action === "hide" ? `${label} hidden from search engines.` : `${label} shown to search engines.`,
  };
}
