"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { JSONContent } from "@tiptap/core";
import { db } from "@/db";
import { postRevisions, postTopics, posts, user } from "@/db/schema";
import { firstImage, makeExcerpt, readingMinutes, sanitizeDoc, storyText } from "@/lib/content";
import { can, canEditPost } from "@/lib/permissions";
import { requireCan, requireUser, type CurrentUser } from "@/lib/session";
import { slugify } from "@/lib/usernames";
import { newId } from "@/lib/utils";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const MAX_REVISIONS = 30;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function loadEditablePost(id: string) {
  const me = await requireUser();
  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!post) throw new Error("Story not found.");
  if (!canEditPost(me, post)) throw new Error("You don't have permission to edit this story.");
  return { me, post };
}

function refreshPublic(slug?: string) {
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/p/${slug}`);
}

/** A slug based on `wanted` that no other story uses. */
async function uniqueSlug(wanted: string, postId: string) {
  const base = slugify(wanted) || "story";
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const clash = await db.query.posts.findFirst({
      where: and(eq(posts.slug, candidate), ne(posts.id, postId)),
      columns: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${postId.slice(0, 6)}`;
}

async function snapshot(postId: string, savedBy: string) {
  const p = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!p) return;
  await db.insert(postRevisions).values({
    id: newId(),
    postId,
    savedBy,
    title: p.title,
    subtitle: p.subtitle,
    content: p.content,
  });
  // Keep only the most recent revisions.
  const keep = await db
    .select({ id: postRevisions.id })
    .from(postRevisions)
    .where(eq(postRevisions.postId, postId))
    .orderBy(desc(postRevisions.createdAt))
    .limit(MAX_REVISIONS);
  if (keep.length === MAX_REVISIONS) {
    await db.delete(postRevisions).where(
      and(
        eq(postRevisions.postId, postId),
        notInArray(
          postRevisions.id,
          keep.map((k) => k.id),
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Drafts and saving                                                   */
/* ------------------------------------------------------------------ */

export async function createDraft() {
  const me = await requireCan("write", "/write");
  // Reuse an untouched draft from the last day instead of piling up empty ones.
  const empty = await db.query.posts.findFirst({
    where: and(
      eq(posts.authorId, me.id),
      eq(posts.status, "draft"),
      eq(posts.title, ""),
      sql`${posts.content} is null`,
      sql`${posts.createdAt} > now() - interval '1 day'`,
    ),
    columns: { id: true },
  });
  if (empty) redirect(`/editor/${empty.id}`);
  const id = newId();
  await db.insert(posts).values({ id, authorId: me.id, slug: `draft-${id}`, title: "", status: "draft" });
  redirect(`/editor/${id}`);
}

/** Dashboard "Quick draft": saves a title and plain text as a new draft. */
export async function quickDraft(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await requireCan("write");
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const body = String(form.get("body") ?? "").trim().slice(0, 20000);
  if (!title && !body) return { ok: false, error: "Add a title or some text first." };
  const content: JSONContent = {
    type: "doc",
    content: body
      .split(/\n{2,}/)
      .filter(Boolean)
      .map((para) => ({ type: "paragraph", content: [{ type: "text", text: para.replace(/\n/g, " ") }] })),
  };
  const text = storyText(content);
  const id = newId();
  await db.insert(posts).values({
    id,
    authorId: me.id,
    slug: `draft-${id}`,
    title,
    content,
    excerpt: makeExcerpt(text),
    readingMinutes: readingMinutes(text),
    status: "draft",
  });
  revalidatePath("/me/stories");
  return { ok: true, message: id };
}

const saveSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200, "Titles can be up to 200 characters."),
  subtitle: z.string().max(300, "Subtitles can be up to 300 characters.").optional().nullable(),
  content: z.custom<JSONContent>((v) => typeof v === "object" && v !== null && (v as JSONContent).type === "doc"),
  coverImage: z.string().max(2000).optional().nullable(),
  topicIds: z.array(z.number().int()).max(5, "Pick up to 5 topics.").default([]),
  slug: z.string().max(120, "Keep the address under 120 characters.").optional().nullable(),
  seoTitle: z.string().max(70, "Search titles can be up to 70 characters.").optional().nullable(),
  seoDescription: z.string().max(160, "Search descriptions can be up to 160 characters.").optional().nullable(),
  authorId: z.string().optional().nullable(),
  featured: z.boolean().optional(),
});

export type SaveInput = z.input<typeof saveSchema>;

async function applySave(input: SaveInput, me: CurrentUser) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const data = parsed.data;
  const post = await db.query.posts.findFirst({ where: eq(posts.id, data.id) });
  if (!post) return { ok: false as const, error: "Story not found." };
  if (!canEditPost(me, post)) return { ok: false as const, error: "You don't have permission to edit this story." };

  const content = sanitizeDoc(data.content);
  const text = storyText(content);
  const isEditor = can(me, "editOthersPosts");
  const update: Partial<typeof posts.$inferInsert> = {
    title: data.title.trim(),
    subtitle: data.subtitle?.trim() || null,
    content,
    excerpt: makeExcerpt(text),
    coverImage: data.coverImage || firstImage(content),
    readingMinutes: readingMinutes(text),
    seoTitle: data.seoTitle?.trim() || null,
    seoDescription: data.seoDescription?.trim() || null,
    updatedAt: new Date(),
  };
  // A custom address only applies once the story has one (drafts get theirs on publish).
  if (data.slug && !post.slug.startsWith("draft-")) {
    const wanted = slugify(data.slug);
    if (wanted && wanted !== post.slug) update.slug = await uniqueSlug(wanted, post.id);
  }
  if (isEditor && data.authorId && data.authorId !== post.authorId) {
    const target = await db.query.user.findFirst({ where: eq(user.id, data.authorId), columns: { id: true, role: true } });
    if (!target || !can(target, "write")) return { ok: false as const, error: "Choose an author who has writing access." };
    update.authorId = target.id;
  }
  if (isEditor && typeof data.featured === "boolean") update.featured = data.featured;

  await db.update(posts).set(update).where(eq(posts.id, post.id));
  await db.delete(postTopics).where(eq(postTopics.postId, post.id));
  if (data.topicIds.length) {
    await db.insert(postTopics).values(data.topicIds.map((topicId) => ({ postId: post.id, topicId })));
  }
  return { ok: true as const, post: { ...post, ...update } };
}

export async function saveStory(input: SaveInput): Promise<ActionResult & { slug?: string }> {
  const me = await requireUser();
  const res = await applySave(input, me);
  if (!res.ok) return res;
  if (res.post.status === "published" || res.post.status === "scheduled") refreshPublic(res.post.slug);
  return { ok: true, slug: res.post.slug };
}

/* ------------------------------------------------------------------ */
/* Publishing workflow                                                 */
/* ------------------------------------------------------------------ */

async function readyToGoLive(postId: string) {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) return { error: "Story not found." };
  if (!post.title.trim()) return { error: "Add a title first." };
  if ((post.excerpt ?? "").length < 20) return { error: "Write a little more first." };
  return { post };
}

/**
 * Publish now, or schedule when `publishAt` is in the future.
 * Contributors can't publish; they use submitForReview instead.
 */
export async function publishStory(input: SaveInput, publishAt?: string | null): Promise<ActionResult & { slug?: string; scheduled?: boolean }> {
  const me = await requireUser();
  if (!can(me, "publish")) return { ok: false, error: "Submit this story for review. An editor will publish it." };
  const saved = await applySave(input, me);
  if (!saved.ok) return saved;
  const check = await readyToGoLive(input.id);
  if ("error" in check) return { ok: false, error: check.error! };
  const post = check.post;

  let when: Date | null = null;
  if (publishAt) {
    when = new Date(publishAt);
    if (Number.isNaN(when.getTime())) return { ok: false, error: "Pick a valid date and time." };
  }
  const scheduled = !!when && when.getTime() > Date.now() + 60_000;
  const slug = post.slug.startsWith("draft-") ? await uniqueSlug(post.title, post.id) : post.slug;

  await db
    .update(posts)
    .set({
      status: scheduled ? "scheduled" : "published",
      slug,
      publishedAt: scheduled ? when : (post.status === "published" && post.publishedAt ? post.publishedAt : new Date()),
      trashedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, post.id));
  await snapshot(post.id, me.id);
  refreshPublic(slug);
  return { ok: true, slug, scheduled, message: scheduled ? "Scheduled." : "Published." };
}

export async function submitForReview(input: SaveInput): Promise<ActionResult> {
  const me = await requireUser();
  const saved = await applySave(input, me);
  if (!saved.ok) return saved;
  const check = await readyToGoLive(input.id);
  if ("error" in check) return { ok: false, error: check.error! };
  if (check.post.status !== "draft") return { ok: false, error: "Only drafts can be submitted for review." };
  await db.update(posts).set({ status: "pending", updatedAt: new Date() }).where(eq(posts.id, check.post.id));
  await snapshot(check.post.id, me.id);
  revalidatePath("/admin", "layout");
  revalidatePath("/me/stories");
  return { ok: true, message: "Submitted for review. An editor will publish it." };
}

/** Back to draft: unpublish, unschedule or withdraw from review. */
export async function unpublishStory(id: string) {
  const { post } = await loadEditablePost(id);
  await db.update(posts).set({ status: "draft", featured: false, updatedAt: new Date() }).where(eq(posts.id, post.id));
  refreshPublic(post.slug);
}

export async function trashStory(id: string) {
  const { post } = await loadEditablePost(id);
  await db
    .update(posts)
    .set({ status: "trash", featured: false, trashedAt: new Date(), updatedAt: new Date() })
    .where(eq(posts.id, post.id));
  refreshPublic(post.slug);
}

export async function restoreStory(id: string) {
  const me = await requireUser();
  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!post || post.status !== "trash") return;
  if (post.authorId !== me.id && !can(me, "editOthersPosts")) return;
  await db.update(posts).set({ status: "draft", trashedAt: null, updatedAt: new Date() }).where(eq(posts.id, id));
  refreshPublic();
}

export async function deleteStoryForever(id: string) {
  const me = await requireUser();
  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!post || post.status !== "trash") return;
  if (post.authorId !== me.id && !can(me, "editOthersPosts")) return;
  await db.delete(posts).where(eq(posts.id, id));
  refreshPublic();
}

/* ------------------------------------------------------------------ */
/* Revisions                                                           */
/* ------------------------------------------------------------------ */

export async function saveRevision(input: SaveInput): Promise<ActionResult> {
  const me = await requireUser();
  const saved = await applySave(input, me);
  if (!saved.ok) return saved;
  await snapshot(input.id, me.id);
  return { ok: true, message: "Revision saved." };
}

export async function getRevision(revisionId: string) {
  const me = await requireUser();
  const rev = await db.query.postRevisions.findFirst({ where: eq(postRevisions.id, revisionId) });
  if (!rev) return null;
  const post = await db.query.posts.findFirst({ where: eq(posts.id, rev.postId) });
  if (!post || !canEditPost(me, post)) return null;
  return { title: rev.title, subtitle: rev.subtitle, text: storyText(rev.content as JSONContent).trim() };
}

/** Restores an older version. The current version is saved as a revision first, so nothing is lost. */
export async function restoreRevision(revisionId: string): Promise<ActionResult> {
  const me = await requireUser();
  const rev = await db.query.postRevisions.findFirst({ where: eq(postRevisions.id, revisionId) });
  if (!rev) return { ok: false, error: "That revision no longer exists." };
  const post = await db.query.posts.findFirst({ where: eq(posts.id, rev.postId) });
  if (!post || !canEditPost(me, post)) return { ok: false, error: "You don't have permission to edit this story." };
  await snapshot(post.id, me.id);
  const text = storyText(rev.content as JSONContent);
  await db
    .update(posts)
    .set({
      title: rev.title,
      subtitle: rev.subtitle,
      content: rev.content,
      excerpt: makeExcerpt(text),
      readingMinutes: readingMinutes(text),
      updatedAt: new Date(),
    })
    .where(eq(posts.id, post.id));
  refreshPublic(post.slug);
  return { ok: true, message: "Revision restored." };
}

/* ------------------------------------------------------------------ */
/* Admin: bulk actions                                                 */
/* ------------------------------------------------------------------ */

export type BulkAction = "publish" | "draft" | "trash" | "restore" | "delete" | "feature" | "unfeature";

export async function bulkPostAction(ids: string[], action: BulkAction): Promise<ActionResult> {
  const me = await requireCan("editOthersPosts");
  if (!ids.length) return { ok: false, error: "Select at least one story." };
  ids = ids.slice(0, 200);
  const rows = await db.query.posts.findMany({ where: inArray(posts.id, ids) });
  let done = 0;
  for (const p of rows) {
    switch (action) {
      case "publish": {
        if (p.status === "trash" || !p.title.trim()) continue;
        const slug = p.slug.startsWith("draft-") ? await uniqueSlug(p.title, p.id) : p.slug;
        await db
          .update(posts)
          .set({ status: "published", slug, publishedAt: p.status === "published" ? p.publishedAt : new Date(), updatedAt: new Date() })
          .where(eq(posts.id, p.id));
        await snapshot(p.id, me.id);
        break;
      }
      case "draft":
        if (p.status === "trash") continue;
        await db.update(posts).set({ status: "draft", featured: false, updatedAt: new Date() }).where(eq(posts.id, p.id));
        break;
      case "trash":
        await db
          .update(posts)
          .set({ status: "trash", featured: false, trashedAt: new Date(), updatedAt: new Date() })
          .where(eq(posts.id, p.id));
        break;
      case "restore":
        if (p.status !== "trash") continue;
        await db.update(posts).set({ status: "draft", trashedAt: null, updatedAt: new Date() }).where(eq(posts.id, p.id));
        break;
      case "delete":
        if (p.status !== "trash") continue;
        await db.delete(posts).where(eq(posts.id, p.id));
        break;
      case "feature":
      case "unfeature":
        if (p.status === "trash") continue;
        await db.update(posts).set({ featured: action === "feature" }).where(eq(posts.id, p.id));
        break;
    }
    done++;
  }
  refreshPublic();
  revalidatePath("/admin", "layout");
  const skipped = rows.length - done;
  return {
    ok: true,
    message: `${done} ${done === 1 ? "story" : "stories"} updated${skipped ? `, ${skipped} skipped` : ""}.`,
  };
}
