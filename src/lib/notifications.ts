import "server-only";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { follows, notifications, posts } from "@/db/schema";
import { newId } from "@/lib/utils";

export type NotificationType = "clap" | "response" | "reply" | "follow" | "new_story" | "published";

const KEEP_DAYS = 90;
const MAX_FOLLOWERS = 500;

/** Records one notification. Nobody is notified about their own actions. */
export async function notify(n: { to: string; actor?: string | null; type: NotificationType; postId?: string | null; commentId?: string | null; at?: Date }) {
  if (n.actor && n.actor === n.to) return;
  await db.insert(notifications).values({
    id: newId(),
    userId: n.to,
    actorId: n.actor ?? null,
    type: n.type,
    postId: n.postId ?? null,
    commentId: n.commentId ?? null,
    createdAt: n.at ?? new Date(),
  });
}

/** Claps from the same person on the same story add up in one unread notification. */
export async function notifyClap(to: string, actor: string, postId: string, added: number) {
  if (to === actor) return;
  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, to), eq(notifications.actorId, actor), eq(notifications.postId, postId), eq(notifications.type, "clap"), isNull(notifications.readAt)))
    .limit(1);
  if (existing) {
    await db
      .update(notifications)
      .set({ count: sql`${notifications.count} + ${added}`, createdAt: new Date() })
      .where(eq(notifications.id, existing.id));
  } else {
    await db.insert(notifications).values({ id: newId(), userId: to, actorId: actor, type: "clap", postId, count: added });
  }
}

/**
 * Tells the author's followers about a story going live, and the author when someone else published it.
 * `at` is the publish time, so a scheduled story's notifications appear when it goes live (no background job).
 */
export async function notifyStoryLive(postId: string, opts: { publishedBy: string; at: Date }) {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId), columns: { authorId: true } });
  if (!post) return;
  // Re-publishing or rescheduling replaces earlier notifications for this story.
  await clearStoryNotifications(postId);
  const fans = await db
    .select({ id: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, post.authorId))
    .limit(MAX_FOLLOWERS);
  const rows = fans
    .filter((f) => f.id !== post.authorId)
    .map((f) => ({ id: newId(), userId: f.id, actorId: post.authorId, type: "new_story", postId, createdAt: opts.at }));
  if (opts.publishedBy !== post.authorId) {
    rows.push({ id: newId(), userId: post.authorId, actorId: opts.publishedBy, type: "published", postId, createdAt: opts.at });
  }
  if (rows.length) await db.insert(notifications).values(rows);
}

/** Removes "new story" and "published" notifications, e.g. when a story is unpublished. */
export async function clearStoryNotifications(postIds: string | string[]) {
  const ids = Array.isArray(postIds) ? postIds : [postIds];
  if (!ids.length) return;
  await db.delete(notifications).where(and(inArray(notifications.postId, ids), inArray(notifications.type, ["new_story", "published"])));
}

/** Unread notifications that have already happened. */
export async function unreadCount(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), lte(notifications.createdAt, sql`now()`)));
  return row?.n ?? 0;
}

export type NotificationItem = {
  id: string;
  type: NotificationType;
  count: number;
  read: boolean;
  createdAt: Date;
  actor: { name: string; username: string | null; image: string | null } | null;
  post: { slug: string; title: string } | null;
  commentBody: string | null;
};

export async function listNotifications(userId: string, filter: "all" | "responses", limit = 60): Promise<NotificationItem[]> {
  // Old notifications are cleared out lazily.
  await db.delete(notifications).where(and(eq(notifications.userId, userId), lte(notifications.createdAt, sql`now() - interval '${sql.raw(String(KEEP_DAYS))} days'`)));
  const rows = await db.execute<{
    id: string;
    type: NotificationType;
    count: number;
    read_at: Date | null;
    created_at: Date;
    actor_name: string | null;
    actor_username: string | null;
    actor_image: string | null;
    post_slug: string | null;
    post_title: string | null;
    post_status: string | null;
    post_published_at: Date | null;
    comment_body: string | null;
  }>(sql`
    select n.id, n.type, n.count, n.read_at, n.created_at,
      a.name as actor_name, a.username as actor_username, a.image as actor_image,
      p.slug as post_slug, p.title as post_title, p.status as post_status, p.published_at as post_published_at,
      c.body as comment_body
    from notifications n
    left join "user" a on a.id = n.actor_id
    left join posts p on p.id = n.post_id
    left join comments c on c.id = n.comment_id
    where n.user_id = ${userId} and n.created_at <= now()
      ${filter === "responses" ? sql`and n.type in ('response', 'reply')` : sql``}
      and (a.banned is null or a.banned = false)
    order by n.created_at desc
    limit ${limit}`);
  return rows.rows
    .filter((r) => !r.post_slug || r.type === "published" || r.post_status === "published" || r.post_status === "scheduled")
    .map((r) => ({
      id: r.id,
      type: r.type,
      count: Number(r.count),
      read: !!r.read_at,
      createdAt: new Date(r.created_at),
      actor: r.actor_name ? { name: r.actor_name, username: r.actor_username, image: r.actor_image } : null,
      post: r.post_slug ? { slug: r.post_slug, title: r.post_title || "Untitled story" } : null,
      commentBody: r.comment_body,
    }));
}

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), lte(notifications.createdAt, sql`now()`)));
}

