"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookmarks, claps, comments, follows, posts, topics, user } from "@/db/schema";
import { getCurrentUser, requireCan, requireUser } from "@/lib/session";
import { can, ROLES, type Role } from "@/lib/permissions";
import { isLive } from "@/lib/live";
import { getSettings } from "@/lib/settings";
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
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    columns: { authorId: true, status: true, publishedAt: true },
  });
  if (!post || !isLive(post) || post.authorId === me.id) return null;
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
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, parsed.data.postId),
    columns: { slug: true, status: true, publishedAt: true },
  });
  if (!post || !isLive(post)) return { ok: false, error: "This story is no longer available." };
  const status = await newCommentStatus(me);
  await db.insert(comments).values({ id: newId(), postId: parsed.data.postId, userId: me.id, body: parsed.data.body, status });
  revalidatePath(`/p/${post.slug}`);
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: status === "approved" ? "Response published." : "Thanks! Your response will appear once a moderator approves it.",
  };
}

/** Whether a new response appears straight away, following Admin → Settings → Responses. */
async function newCommentStatus(me: { id: string; role: string }): Promise<"approved" | "pending"> {
  if (can(me, "write")) return "approved"; // team members are trusted
  const { commentApproval } = await getSettings();
  if (commentApproval === "none") return "approved";
  if (commentApproval === "all") return "pending";
  const earlier = await db.query.comments.findFirst({
    where: and(eq(comments.userId, me.id), eq(comments.status, "approved")),
    columns: { id: true },
  });
  return earlier ? "approved" : "pending";
}

export type CommentModeration = "approve" | "unapprove" | "spam" | "delete";

export async function moderateComments(ids: string[], action: CommentModeration): Promise<ActionResult> {
  await requireCan("moderateComments");
  if (!ids.length) return { ok: false, error: "Select at least one response." };
  ids = ids.slice(0, 200);
  if (action === "delete") await db.delete(comments).where(inArray(comments.id, ids));
  else {
    const status = action === "approve" ? "approved" : action === "spam" ? "spam" : "pending";
    await db.update(comments).set({ status }).where(inArray(comments.id, ids));
  }
  revalidatePath("/", "layout");
  const n = ids.length;
  const verb = { approve: "approved", unapprove: "moved to pending", spam: "marked as spam", delete: "deleted" }[action];
  return { ok: true, message: `${n} ${n === 1 ? "response" : "responses"} ${verb}.` };
}

export async function deleteComment(commentId: string) {
  const me = await requireUser();
  const c = await db.query.comments.findFirst({ where: eq(comments.id, commentId) });
  if (!c) return;
  const post = await db.query.posts.findFirst({ where: eq(posts.id, c.postId), columns: { slug: true, authorId: true } });
  // Comment author, story author or a moderator can remove a response.
  if (c.userId !== me.id && post?.authorId !== me.id && !can(me, "moderateComments")) return;
  await db.delete(comments).where(eq(comments.id, commentId));
  if (post) revalidatePath(`/p/${post.slug}`);
  revalidatePath("/admin/comments");
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

export async function adminSetRole(userId: string, role: Role) {
  const me = await requireCan("manageUsers");
  if (userId === me.id || !ROLES.includes(role)) return; // admins cannot change their own role
  await db.update(user).set({ role }).where(eq(user.id, userId));
  revalidatePath("/admin/users");
}

export async function adminSetBanned(userId: string, banned: boolean) {
  const me = await requireCan("manageUsers");
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
  await requireCan("manageTopics");
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
  await requireCan("manageTopics");
  await db.delete(topics).where(eq(topics.id, id));
  revalidatePath("/", "layout");
}
