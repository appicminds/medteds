"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { JSONContent } from "@tiptap/core";
import { db } from "@/db";
import { bookmarks, claps, comments, follows, postTopics, posts, topics, user } from "@/db/schema";
import { getCurrentUser, requireAdmin, requireUser } from "@/lib/session";
import { firstImage, makeExcerpt, readingMinutes, storyText } from "@/lib/content";
import { newId } from "@/lib/utils";
import { normalizeUsername, slugify } from "@/lib/usernames";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const MAX_CLAPS = 50;

/* ------------------------------------------------------------------ */
/* Reader interactions                                                 */
/* ------------------------------------------------------------------ */

export async function clapStory(postId: string, times: number): Promise<{ total: number; mine: number } | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  const add = Math.max(1, Math.min(MAX_CLAPS, Math.floor(times)));
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId), columns: { authorId: true, status: true } });
  if (!post || post.status !== "published" || post.authorId === me.id) return null;
  await db
    .insert(claps)
    .values({ userId: me.id, postId, count: add })
    .onConflictDoUpdate({
      target: [claps.userId, claps.postId],
      set: { count: sql`least(${claps.count} + ${add}, ${MAX_CLAPS})` },
    });
  const [[mine], [total]] = await Promise.all([
    db.select({ n: claps.count }).from(claps).where(and(eq(claps.userId, me.id), eq(claps.postId, postId))),
    db.select({ n: sql<number>`coalesce(sum(${claps.count}),0)::int` }).from(claps).where(eq(claps.postId, postId)),
  ]);
  return { total: total.n, mine: mine?.n ?? 0 };
}

export async function toggleBookmark(postId: string): Promise<boolean | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, me.id), eq(bookmarks.postId, postId)),
  });
  if (existing) {
    await db.delete(bookmarks).where(and(eq(bookmarks.userId, me.id), eq(bookmarks.postId, postId)));
  } else {
    await db.insert(bookmarks).values({ userId: me.id, postId }).onConflictDoNothing();
  }
  revalidatePath("/reading-list");
  return !existing;
}

export async function toggleFollow(userId: string): Promise<boolean | null> {
  const me = await getCurrentUser();
  if (!me || me.id === userId) return null;
  const existing = await db.query.follows.findFirst({
    where: and(eq(follows.followerId, me.id), eq(follows.followingId, userId)),
  });
  if (existing) {
    await db.delete(follows).where(and(eq(follows.followerId, me.id), eq(follows.followingId, userId)));
  } else {
    await db.insert(follows).values({ followerId: me.id, followingId: userId }).onConflictDoNothing();
  }
  revalidatePath("/", "layout");
  return !existing;
}

const commentSchema = z.object({
  postId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first.").max(5000, "Responses can be up to 5,000 characters."),
});

export async function addComment(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Sign in to respond." };
  const parsed = commentSchema.safeParse({ postId: form.get("postId"), body: form.get("body") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const post = await db.query.posts.findFirst({ where: eq(posts.id, parsed.data.postId), columns: { slug: true, status: true } });
  if (!post || post.status !== "published") return { ok: false, error: "This story is no longer available." };
  await db.insert(comments).values({ id: newId(), postId: parsed.data.postId, userId: me.id, body: parsed.data.body });
  revalidatePath(`/p/${post.slug}`);
  return { ok: true, message: "Response published." };
}

export async function deleteComment(commentId: string) {
  const me = await requireUser();
  const c = await db.query.comments.findFirst({ where: eq(comments.id, commentId) });
  if (!c) return;
  const post = await db.query.posts.findFirst({ where: eq(posts.id, c.postId), columns: { slug: true, authorId: true } });
  // Comment author, story author or admin can remove a response.
  if (c.userId !== me.id && post?.authorId !== me.id && me.role !== "admin") return;
  await db.delete(comments).where(eq(comments.id, commentId));
  if (post) revalidatePath(`/p/${post.slug}`);
  revalidatePath("/admin/comments");
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export async function createDraft() {
  const me = await requireUser("/write");
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

/** Keep only safe links and images in stored story JSON. */
function sanitizeDoc(node: JSONContent): JSONContent {
  const safeUrl = (u: unknown) =>
    typeof u === "string" && (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || u.startsWith("/"));
  const out: JSONContent = { ...node };
  if (node.marks) {
    out.marks = node.marks.filter((m) => m.type !== "link" || safeUrl(m.attrs?.href));
  }
  if (node.type === "image" && !safeUrl(node.attrs?.src)) {
    return { type: "paragraph" };
  }
  if (node.content) out.content = node.content.map(sanitizeDoc);
  return out;
}

const saveSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200, "Titles can be up to 200 characters."),
  subtitle: z.string().max(300, "Subtitles can be up to 300 characters.").optional().nullable(),
  content: z.custom<JSONContent>((v) => typeof v === "object" && v !== null && (v as JSONContent).type === "doc"),
  coverImage: z.string().max(2000).optional().nullable(),
  topicIds: z.array(z.number().int()).max(5, "Pick up to 5 topics.").default([]),
});

export type SaveInput = z.input<typeof saveSchema>;

async function loadOwnPost(id: string) {
  const me = await requireUser();
  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!post) throw new Error("Story not found.");
  if (post.authorId !== me.id && me.role !== "admin") throw new Error("You can only edit your own stories.");
  return { me, post };
}

export async function saveStory(input: SaveInput): Promise<ActionResult & { savedAt?: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;
  let post;
  try {
    ({ post } = await loadOwnPost(data.id));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const content = sanitizeDoc(data.content);
  const text = storyText(content);
  const cover = data.coverImage || firstImage(content);
  await db
    .update(posts)
    .set({
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || null,
      content,
      excerpt: makeExcerpt(text),
      coverImage: cover,
      readingMinutes: readingMinutes(text),
      updatedAt: new Date(),
    })
    .where(eq(posts.id, post.id));
  await db.delete(postTopics).where(eq(postTopics.postId, post.id));
  if (data.topicIds.length) {
    await db.insert(postTopics).values(data.topicIds.map((topicId) => ({ postId: post.id, topicId })));
  }
  if (post.status === "published") revalidatePath(`/p/${post.slug}`);
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function publishStory(input: SaveInput): Promise<ActionResult & { slug?: string }> {
  const saved = await saveStory(input);
  if (!saved.ok) return saved;
  const { post } = await loadOwnPost(input.id);
  if (!post.title.trim()) return { ok: false, error: "Add a title before publishing." };
  if ((post.excerpt ?? "").length < 20) return { ok: false, error: "Write a little more before publishing." };
  let slug = post.slug;
  if (post.status !== "published" || slug.startsWith("draft-")) {
    slug = `${slugify(post.title) || "story"}-${post.id.slice(0, 6)}`;
  }
  await db
    .update(posts)
    .set({ status: "published", slug, publishedAt: post.publishedAt ?? new Date(), updatedAt: new Date() })
    .where(eq(posts.id, post.id));
  revalidatePath("/", "layout");
  return { ok: true, slug };
}

export async function unpublishStory(id: string) {
  const { post } = await loadOwnPost(id);
  await db.update(posts).set({ status: "draft", featured: false, updatedAt: new Date() }).where(eq(posts.id, post.id));
  revalidatePath("/", "layout");
}

export async function deleteStory(id: string) {
  const { post } = await loadOwnPost(id);
  await db.delete(posts).where(eq(posts.id, post.id));
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(60, "Names can be up to 60 characters."),
  username: z
    .string()
    .trim()
    .min(3, "Usernames need at least 3 characters.")
    .max(30, "Usernames can be up to 30 characters.")
    .regex(/^[a-z0-9_]+$/i, "Use only letters, numbers and underscores."),
  bio: z.string().trim().max(160, "Bios can be up to 160 characters.").optional(),
  image: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => !v || v.startsWith("/") || /^https:\/\//i.test(v), "Upload a photo instead of pasting a link.")
    .optional(),
});

export async function updateProfile(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await requireUser("/settings");
  const parsed = profileSchema.safeParse({
    name: form.get("name"),
    username: form.get("username"),
    bio: form.get("bio") ?? "",
    image: form.get("image") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const username = normalizeUsername(parsed.data.username);
  const taken = await db.query.user.findFirst({ where: eq(user.username, username), columns: { id: true } });
  if (taken && taken.id !== me.id) return { ok: false, error: `@${username} is already taken. Try another.` };
  await db
    .update(user)
    .set({
      name: parsed.data.name,
      username,
      bio: parsed.data.bio || null,
      image: parsed.data.image || null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, me.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export async function adminSetFeatured(postId: string, featured: boolean) {
  await requireAdmin();
  await db.update(posts).set({ featured }).where(eq(posts.id, postId));
  revalidatePath("/", "layout");
}

export async function adminSetStatus(postId: string, status: "draft" | "published") {
  await requireAdmin();
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) return;
  let slug = post.slug;
  if (status === "published" && slug.startsWith("draft-")) slug = `${slugify(post.title) || "story"}-${post.id.slice(0, 6)}`;
  await db
    .update(posts)
    .set({
      status,
      slug,
      featured: status === "draft" ? false : post.featured,
      publishedAt: status === "published" ? (post.publishedAt ?? new Date()) : post.publishedAt,
    })
    .where(eq(posts.id, postId));
  revalidatePath("/", "layout");
}

export async function adminDeleteStory(postId: string) {
  await requireAdmin();
  await db.delete(posts).where(eq(posts.id, postId));
  revalidatePath("/", "layout");
}

export async function adminSetRole(userId: string, role: "user" | "admin") {
  const me = await requireAdmin();
  if (userId === me.id) return; // admins cannot demote themselves
  await db.update(user).set({ role }).where(eq(user.id, userId));
  revalidatePath("/admin/users");
}

export async function adminSetBanned(userId: string, banned: boolean) {
  const me = await requireAdmin();
  if (userId === me.id) return;
  await db.update(user).set({ banned }).where(eq(user.id, userId));
  if (banned) {
    // Sign the account out everywhere.
    await db.execute(sql`delete from "session" where user_id = ${userId}`);
  }
  revalidatePath("/", "layout");
}

const topicSchema = z.object({
  name: z.string().trim().min(2, "Topic names need at least 2 characters.").max(40, "Topic names can be up to 40 characters."),
  description: z.string().trim().max(200, "Descriptions can be up to 200 characters.").optional(),
});

export async function adminSaveTopic(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = topicSchema.safeParse({ name: form.get("name"), description: form.get("description") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const idRaw = form.get("id");
  const slug = slugify(parsed.data.name);
  const clash = await db.query.topics.findFirst({ where: eq(topics.slug, slug) });
  if (idRaw) {
    const id = Number(idRaw);
    if (clash && clash.id !== id) return { ok: false, error: `A topic called “${clash.name}” already exists.` };
    await db
      .update(topics)
      .set({ name: parsed.data.name, slug, description: parsed.data.description || null })
      .where(eq(topics.id, id));
  } else {
    if (clash) return { ok: false, error: `A topic called “${clash.name}” already exists.` };
    await db.insert(topics).values({ name: parsed.data.name, slug, description: parsed.data.description || null });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: idRaw ? "Topic updated." : "Topic added." };
}

export async function adminDeleteTopic(id: number) {
  await requireAdmin();
  await db.delete(topics).where(eq(topics.id, id));
  revalidatePath("/", "layout");
}
