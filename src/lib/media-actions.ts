"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { media, pages, posts, user } from "@/db/schema";
import { can } from "@/lib/permissions";
import { requireUser, type CurrentUser } from "@/lib/session";
import { removeImage } from "@/lib/storage";

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  alt: string;
  width: number | null;
  height: number | null;
  size: number;
  mimeType: string;
  createdAt: string;
  uploaderName: string;
  mine: boolean;
};

const PAGE = 40;

function scopeFor(me: CurrentUser): SQL | undefined {
  // Editors see the whole library; everyone else sees only their own uploads.
  return can(me, "manageMedia") ? undefined : eq(media.userId, me.id);
}

export async function listMedia(opts: { query?: string; page?: number } = {}): Promise<{ items: MediaItem[]; hasMore: boolean }> {
  const me = await requireUser();
  if (!can(me, "upload")) return { items: [], hasMore: false };
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.query?.trim();
  const rows = await db
    .select({
      id: media.id,
      url: media.url,
      filename: media.filename,
      alt: media.alt,
      width: media.width,
      height: media.height,
      size: media.size,
      mimeType: media.mimeType,
      createdAt: media.createdAt,
      userId: media.userId,
      uploaderName: user.name,
    })
    .from(media)
    .innerJoin(user, eq(media.userId, user.id))
    .where(and(scopeFor(me), q ? or(ilike(media.filename, `%${q}%`), ilike(media.alt, `%${q}%`)) : undefined))
    .orderBy(desc(media.createdAt))
    .limit(PAGE + 1)
    .offset((page - 1) * PAGE);
  return {
    hasMore: rows.length > PAGE,
    items: rows.slice(0, PAGE).map(({ userId, createdAt, ...r }) => ({
      ...r,
      createdAt: createdAt.toISOString(),
      mine: userId === me.id,
    })),
  };
}

async function loadOwnMedia(id: string) {
  const me = await requireUser();
  const row = await db.query.media.findFirst({ where: eq(media.id, id), columns: { id: true, userId: true, url: true } });
  if (!row) throw new Error("That image no longer exists.");
  if (row.userId !== me.id && !can(me, "manageMedia")) throw new Error("You can only change your own images.");
  return row;
}

const altSchema = z.string().trim().max(250, "Alt text can be up to 250 characters.");

export async function updateMediaAlt(id: string, alt: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = altSchema.safeParse(alt);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await loadOwnMedia(id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await db.update(media).set({ alt: parsed.data }).where(eq(media.id, id));
  revalidatePath("/admin/media");
  return { ok: true };
}

/** Stories and profiles that use this image. */
export async function mediaUsage(id: string) {
  const row = await loadOwnMedia(id);
  const like = `%${row.url}%`;
  const [usedInPosts, usedAsAvatar] = await Promise.all([
    db
      .select({ id: posts.id, title: posts.title, slug: posts.slug, status: posts.status })
      .from(posts)
      .where(or(eq(posts.coverImage, row.url), sql`${posts.content}::text like ${like}`))
      .limit(20),
    db.select({ name: user.name, username: user.username }).from(user).where(eq(user.image, row.url)).limit(20),
  ]);
  const usedInPages = await db
    .select({ id: pages.id, title: pages.title })
    .from(pages)
    .where(sql`${pages.content}::text like ${like}`)
    .limit(20);
  return { posts: usedInPosts, pages: usedInPages, profiles: usedAsAvatar };
}

export async function deleteMedia(id: string, force = false): Promise<{ ok: true } | { ok: false; error: string; inUse?: boolean }> {
  try {
    await loadOwnMedia(id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!force) {
    const usage = await mediaUsage(id);
    const n = usage.posts.length + usage.pages.length + usage.profiles.length;
    if (n) return { ok: false, inUse: true, error: `This image is used in ${n} place${n === 1 ? "" : "s"}. Deleting it will leave a broken image there.` };
  }
  await removeImage(id);
  revalidatePath("/admin/media");
  return { ok: true };
}
