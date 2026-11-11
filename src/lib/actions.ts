"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { claps, commentClaps, comments, follows, mutes, notifications, posts, reports, topicFollows, topics, user } from "@/db/schema";
import { getCurrentUser, requireCan, requireUser } from "@/lib/session";
import { can, ROLES, type Role } from "@/lib/permissions";
import { isLive } from "@/lib/live";
import { getSettings } from "@/lib/settings";
import { newId } from "@/lib/utils";
import { REPORT_REASONS } from "@/lib/report-reasons";
import { notify, notifyClap } from "@/lib/notifications";
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
  const [before] = await db.select({ n: claps.count }).from(claps).where(and(eq(claps.userId, me.id), eq(claps.postId, postId)));
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
  const added = (mine?.n ?? 0) - (before?.n ?? 0);
  if (added > 0) await notifyClap(post.authorId, me.id, postId, added);
  return { total: total.n, mine: mine?.n ?? 0 };
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
    await notify({ to: userId, actor: me.id, type: "follow" });
  }
  revalidatePath("/", "layout");
  return !existing;
}

/** Follows or unfollows a topic. Returns the new state, or null when signed out. */
export async function toggleTopicFollow(topicId: number): Promise<boolean | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  const where = and(eq(topicFollows.userId, me.id), eq(topicFollows.topicId, topicId));
  const existing = await db.query.topicFollows.findFirst({ where });
  if (existing) await db.delete(topicFollows).where(where);
  else {
    const topic = await db.query.topics.findFirst({ where: eq(topics.id, topicId), columns: { id: true } });
    if (!topic) return null;
    await db.insert(topicFollows).values({ userId: me.id, topicId }).onConflictDoNothing();
  }
  revalidatePath("/", "layout");
  return !existing;
}

/** Saves the topics picked on the welcome screen. */
export async function setTopicFollows(topicIds: number[]): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Sign in first." };
  const ids = [...new Set(topicIds.filter((n) => Number.isInteger(n)))].slice(0, 50);
  await db.delete(topicFollows).where(eq(topicFollows.userId, me.id));
  if (ids.length) {
    const valid = await db.select({ id: topics.id }).from(topics).where(inArray(topics.id, ids));
    if (valid.length) await db.insert(topicFollows).values(valid.map((t) => ({ userId: me.id, topicId: t.id }))).onConflictDoNothing();
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const commentSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().max(40).optional(),
  body: z.string().trim().min(1, "Write something first.").max(5000, "Responses can be up to 5,000 characters."),
});

export async function addComment(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Sign in to respond." };
  const parsed = commentSchema.safeParse({ postId: form.get("postId"), body: form.get("body"), parentId: form.get("parentId") || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, parsed.data.postId),
    columns: { slug: true, status: true, publishedAt: true },
  });
  if (!post || !isLive(post)) return { ok: false, error: "This story is no longer available." };
  // Replies attach to a top-level response on the same story.
  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const parent = await db.query.comments.findFirst({ where: eq(comments.id, parsed.data.parentId), columns: { id: true, postId: true, parentId: true, status: true } });
    if (!parent || parent.postId !== parsed.data.postId || parent.status !== "approved") return { ok: false, error: "That response is no longer available." };
    parentId = parent.parentId ?? parent.id;
  }
  const status = await newCommentStatus(me);
  const commentId = newId();
  await db.insert(comments).values({ id: commentId, postId: parsed.data.postId, userId: me.id, body: parsed.data.body, status, parentId });
  // Held responses notify the author once a moderator approves them.
  if (status === "approved") await notifyResponse(commentId);
  revalidatePath(`/p/${post.slug}`);
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: status === "approved" ? "Response published." : "Thanks! Your response will appear once a moderator approves it.",
  };
}

/** Tells the story's author about a published response, and the parent's author about a reply. Once. */
async function notifyResponse(commentId: string) {
  const c = await db
    .select({ id: comments.id, postId: comments.postId, userId: comments.userId, parentId: comments.parentId, authorId: posts.authorId })
    .from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(eq(comments.id, commentId));
  const row = c[0];
  if (!row) return;
  const already = await db.query.notifications.findFirst({ where: eq(notifications.commentId, commentId), columns: { id: true } });
  if (already) return;
  let parentAuthor: string | null = null;
  if (row.parentId) {
    const parent = await db.query.comments.findFirst({ where: eq(comments.id, row.parentId), columns: { userId: true } });
    parentAuthor = parent?.userId ?? null;
    if (parentAuthor) await notify({ to: parentAuthor, actor: row.userId, type: "reply", postId: row.postId, commentId });
  }
  if (row.authorId !== parentAuthor) await notify({ to: row.authorId, actor: row.userId, type: "response", postId: row.postId, commentId });
}

/** Claps for a response. Returns the new totals, or null when not allowed. */
export async function clapComment(commentId: string, times: number): Promise<{ total: number; mine: number } | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  const add = Math.max(1, Math.min(MAX_CLAPS, Math.floor(times)));
  const c = await db.query.comments.findFirst({ where: eq(comments.id, commentId), columns: { userId: true, status: true } });
  if (!c || c.status !== "approved" || c.userId === me.id) return null;
  await db
    .insert(commentClaps)
    .values({ userId: me.id, commentId, count: add })
    .onConflictDoUpdate({ target: [commentClaps.userId, commentClaps.commentId], set: { count: sql`least(${commentClaps.count} + ${add}, ${MAX_CLAPS})` } });
  const [[mine], [total]] = await Promise.all([
    db.select({ n: commentClaps.count }).from(commentClaps).where(and(eq(commentClaps.userId, me.id), eq(commentClaps.commentId, commentId))),
    db.select({ n: sql<number>`coalesce(sum(${commentClaps.count}),0)::int` }).from(commentClaps).where(eq(commentClaps.commentId, commentId)),
  ]);
  return { total: total.n, mine: mine?.n ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Mute and report                                                     */
/* ------------------------------------------------------------------ */

/** Mutes or unmutes a writer or topic. Returns the new state, or null when not allowed. */
export async function toggleMute(targetType: "user" | "topic", targetId: string): Promise<boolean | null> {
  const me = await getCurrentUser();
  if (!me || (targetType === "user" && targetId === me.id)) return null;
  if (targetType !== "user" && targetType !== "topic") return null;
  const where = and(eq(mutes.userId, me.id), eq(mutes.targetType, targetType), eq(mutes.targetId, targetId));
  const existing = await db.query.mutes.findFirst({ where });
  if (existing) await db.delete(mutes).where(where);
  else {
    await db.insert(mutes).values({ userId: me.id, targetType, targetId }).onConflictDoNothing();
    if (targetType === "topic") await db.delete(topicFollows).where(and(eq(topicFollows.userId, me.id), eq(topicFollows.topicId, Number(targetId))));
    if (targetType === "user") await db.delete(follows).where(and(eq(follows.followerId, me.id), eq(follows.followingId, targetId)));
  }
  revalidatePath("/", "layout");
  return !existing;
}

const reportSchema = z
  .object({
    postId: z.string().max(40).optional(),
    commentId: z.string().max(40).optional(),
    reason: z.enum(REPORT_REASONS),
    note: z.string().trim().max(1000, "Keep the note under 1,000 characters.").optional(),
  })
  .refine((v) => !!v.postId !== !!v.commentId, "Report a story or a response.");

export async function reportContent(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Sign in to report." };
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const exists = d.postId
    ? await db.query.posts.findFirst({ where: eq(posts.id, d.postId), columns: { id: true } })
    : await db.query.comments.findFirst({ where: eq(comments.id, d.commentId!), columns: { id: true } });
  if (!exists) return { ok: false, error: "That's no longer available." };
  const dup = await db.query.reports.findFirst({
    where: and(eq(reports.reporterId, me.id), eq(reports.status, "open"), d.postId ? eq(reports.postId, d.postId) : eq(reports.commentId, d.commentId!)),
    columns: { id: true },
  });
  if (!dup) await db.insert(reports).values({ id: newId(), reporterId: me.id, postId: d.postId ?? null, commentId: d.commentId ?? null, reason: d.reason, note: d.note || null });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Thanks for letting us know. The editors will review it." };
}

export type ReportAction = "dismiss" | "resolve" | "resolve-remove";

/** Closes a report. "resolve-remove" also trashes the story or marks the response as spam. */
export async function handleReport(id: string, action: ReportAction): Promise<ActionResult> {
  const me = await requireCan("moderateComments");
  const rep = await db.query.reports.findFirst({ where: eq(reports.id, id) });
  if (!rep) return { ok: false, error: "That report no longer exists." };
  if (action === "resolve-remove") {
    if (rep.postId) {
      if (!can(me, "editOthersPosts")) return { ok: false, error: "You can't remove stories." };
      await db.update(posts).set({ status: "trash", featured: false, trashedAt: new Date(), updatedAt: new Date() }).where(eq(posts.id, rep.postId));
    } else if (rep.commentId) {
      await db.update(comments).set({ status: "spam" }).where(eq(comments.id, rep.commentId));
    }
  }
  // Close every open report about the same thing.
  await db
    .update(reports)
    .set({ status: action === "dismiss" ? "dismissed" : "resolved", resolvedBy: me.id, resolvedAt: new Date() })
    .where(and(eq(reports.status, "open"), rep.postId ? eq(reports.postId, rep.postId) : eq(reports.commentId, rep.commentId!)));
  revalidatePath("/", "layout");
  return { ok: true, message: action === "dismiss" ? "Report dismissed." : action === "resolve" ? "Report resolved." : rep.postId ? "Story moved to trash." : "Response marked as spam." };
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
    if (status === "approved") for (const id of ids) await notifyResponse(id);
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
