import "server-only";
import { and, desc, eq, ne, sql, inArray, notInArray, type SQL } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { db } from "@/db";
import {
  bookmarks,
  claps,
  comments,
  follows,
  highlights,
  listItems,
  mutes,
  listSaves,
  lists,
  pages,
  postRevisions,
  postTopics,
  posts,
  readingHistory,
  reports,
  topicFollows,
  topics,
  user,
} from "@/db/schema";
import { storyText } from "@/lib/content";
import { isLive, liveRawP, liveSql } from "@/lib/live";
import { clip, DESCRIPTION_MAX, effectiveSeo, seoChecks, seoScore } from "@/lib/seo-auto";

export type StoryCardData = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  coverImage: string | null;
  readingMinutes: number;
  publishedAt: Date | null;
  featured: boolean;
  clapCount: number;
  commentCount: number;
  author: { id: string; name: string; username: string; image: string | null };
  topics: { slug: string; name: string }[];
};

// Subqueries in a select list are written with qualified names: Drizzle drops table prefixes there.
const clapCount = sql<number>`coalesce((select sum(c.count) from claps c where c.post_id = "posts"."id"), 0)::int`;
const viewCount = sql<number>`coalesce((select sum(v.count) from post_views v where v.post_id = "posts"."id"), 0)::int`;
const commentCount = sql<number>`(select count(*) from comments cm where cm.post_id = "posts"."id" and cm.status = 'approved')::int`;

const cardColumns = {
  id: posts.id,
  slug: posts.slug,
  title: posts.title,
  subtitle: posts.subtitle,
  excerpt: posts.excerpt,
  coverImage: posts.coverImage,
  readingMinutes: posts.readingMinutes,
  publishedAt: posts.publishedAt,
  featured: posts.featured,
  clapCount,
  commentCount,
  authorId: user.id,
  authorName: user.name,
  authorUsername: user.username,
  authorImage: user.image,
};

type CardRow = {
  [K in keyof typeof cardColumns]: unknown;
} & Record<string, unknown>;

async function attachTopics(rows: CardRow[]): Promise<StoryCardData[]> {
  const ids = rows.map((r) => r.id as string);
  const topicRows = ids.length
    ? await db
        .select({ postId: postTopics.postId, slug: topics.slug, name: topics.name })
        .from(postTopics)
        .innerJoin(topics, eq(postTopics.topicId, topics.id))
        .where(inArray(postTopics.postId, ids))
    : [];
  return rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    subtitle: r.subtitle as string | null,
    excerpt: r.excerpt as string | null,
    coverImage: r.coverImage as string | null,
    readingMinutes: r.readingMinutes as number,
    publishedAt: r.publishedAt as Date | null,
    featured: r.featured as boolean,
    clapCount: Number(r.clapCount),
    commentCount: Number(r.commentCount),
    author: {
      id: r.authorId as string,
      name: r.authorName as string,
      username: (r.authorUsername as string) ?? (r.authorId as string),
      image: r.authorImage as string | null,
    },
    topics: topicRows.filter((t) => t.postId === r.id).map(({ slug, name }) => ({ slug, name })),
  }));
}

const published = and(liveSql, eq(user.banned, false));

export async function listStories(opts: {
  topicSlug?: string;
  authorId?: string;
  followingOf?: string;
  featured?: boolean;
  query?: string;
  /** Put stories from this reader's followed topics and writers first. */
  personalFor?: string;
  /** Hide writers and topics this reader muted. */
  viewerId?: string;
  limit?: number;
  offset?: number;
}): Promise<StoryCardData[]> {
  const where: (SQL | undefined)[] = [published];
  if (opts.authorId) where.push(eq(posts.authorId, opts.authorId));
  if (opts.featured) where.push(eq(posts.featured, true));
  if (opts.topicSlug) {
    where.push(
      sql`${posts.id} in (select ${postTopics.postId} from ${postTopics} join ${topics} on ${topics.id} = ${postTopics.topicId} where ${topics.slug} = ${opts.topicSlug})`,
    );
  }
  if (opts.followingOf) {
    where.push(
      sql`${posts.authorId} in (select ${follows.followingId} from ${follows} where ${follows.followerId} = ${opts.followingOf})`,
    );
  }
  if (opts.viewerId) where.push(notMutedBy(opts.viewerId));
  let order: SQL[] = [desc(posts.publishedAt)];
  if (opts.personalFor) {
    const uid = opts.personalFor;
    order = [
      sql`case when "posts"."author_id" in (select f.following_id from follows f where f.follower_id = ${uid})
        or "posts"."id" in (select pt.post_id from post_topics pt join topic_follows tf on tf.topic_id = pt.topic_id where tf.user_id = ${uid})
        then 0 else 1 end`,
      desc(posts.publishedAt),
    ];
  }
  if (opts.query) {
    const doc = sql`to_tsvector('english', ${posts.title} || ' ' || coalesce(${posts.subtitle}, '') || ' ' || coalesce(${posts.excerpt}, '') || ' ' || ${user.name})`;
    const q = sql`websearch_to_tsquery('english', ${opts.query})`;
    where.push(sql`(${doc} @@ ${q} or ${posts.title} ilike ${"%" + opts.query + "%"})`);
    order = [sql`ts_rank(${doc}, ${q}) desc`, desc(posts.publishedAt)];
  }
  const rows = await db
    .select(cardColumns)
    .from(posts)
    .innerJoin(user, eq(posts.authorId, user.id))
    .where(and(...where))
    .orderBy(...order)
    .limit(opts.limit ?? 20)
    .offset(opts.offset ?? 0);
  return attachTopics(rows);
}

export async function getStory(slug: string, viewerId?: string) {
  const rows = await db
    .select({
      ...cardColumns,
      content: posts.content,
      status: posts.status,
      updatedAt: posts.updatedAt,
      seoTitle: posts.seoTitle,
      seoDescription: posts.seoDescription,
      noindex: posts.noindex,
      canonicalUrl: posts.canonicalUrl,
      shareImage: posts.shareImage,
      authorBio: user.bio,
      authorBanned: user.banned,
    })
    .from(posts)
    .innerJoin(user, eq(posts.authorId, user.id))
    .where(eq(posts.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const [card] = await attachTopics([row]);

  const [followers] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followingId, card.author.id));

  let viewer = { claps: 0, bookmarked: false, following: false };
  if (viewerId) {
    const [c, b, f] = await Promise.all([
      db.query.claps.findFirst({ where: and(eq(claps.userId, viewerId), eq(claps.postId, card.id)) }),
      bookmarkedIds(viewerId, [card.id]).then((ids) => ids.has(card.id)),
      db.query.follows.findFirst({
        where: and(eq(follows.followerId, viewerId), eq(follows.followingId, card.author.id)),
      }),
    ]);
    viewer = { claps: c?.count ?? 0, bookmarked: !!b, following: !!f };
  }

  return {
    ...card,
    content: row.content,
    status: row.status,
    updatedAt: row.updatedAt,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    noindex: row.noindex,
    canonicalUrl: row.canonicalUrl,
    shareImage: row.shareImage,
    authorBio: row.authorBio,
    authorBanned: row.authorBanned,
    authorFollowers: followers?.n ?? 0,
    viewer,
  };
}

/** Approved responses, plus the viewer's own responses that are waiting for approval. */
/** Stories by writers or in topics this reader muted are left out. */
function notMutedBy(viewerId: string) {
  return sql`("posts"."author_id" not in (select m.target_id from mutes m where m.user_id = ${viewerId} and m.target_type = 'user')
    and not exists (select 1 from post_topics pt where pt.post_id = "posts"."id"
      and pt.topic_id::text in (select m.target_id from mutes m where m.user_id = ${viewerId} and m.target_type = 'topic')))`;
}

/** Writers and topics a reader muted. */
export async function mutedBy(viewerId: string | undefined) {
  if (!viewerId) return { users: new Set<string>(), topics: new Set<number>() };
  const rows = await db.select({ type: mutes.targetType, id: mutes.targetId }).from(mutes).where(eq(mutes.userId, viewerId));
  return {
    users: new Set(rows.filter((r) => r.type === "user").map((r) => r.id)),
    topics: new Set(rows.filter((r) => r.type === "topic").map((r) => Number(r.id))),
  };
}

/** Muted writers and topics with names, for Settings. */
export async function mutedList(viewerId: string) {
  const rows = await db.execute<{ type: string; id: string; name: string | null; extra: string | null }>(sql`
    select m.target_type as type, m.target_id as id,
      coalesce(u.name, t.name) as name, coalesce(u.username, t.slug) as extra
    from mutes m
    left join "user" u on m.target_type = 'user' and u.id = m.target_id
    left join topics t on m.target_type = 'topic' and t.id::text = m.target_id
    where m.user_id = ${viewerId}
    order by m.created_at desc`);
  return rows.rows.filter((r) => r.name).map((r) => ({ type: r.type as "user" | "topic", id: r.id, name: r.name!, extra: r.extra }));
}

export type CommentRow = {
  id: string;
  parentId: string | null;
  body: string;
  status: string;
  createdAt: Date;
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
  clapCount: number;
  myClaps: number;
};

/** Approved responses (oldest replies under each), plus the viewer's own responses that are waiting for approval. */
export async function getComments(postId: string, viewerId?: string): Promise<CommentRow[]> {
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      body: comments.body,
      status: comments.status,
      createdAt: comments.createdAt,
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      clapCount: sql<number>`(select coalesce(sum(cc.count), 0) from comment_claps cc where cc.comment_id = "comments"."id")::int`,
      myClaps: viewerId
        ? sql<number>`(select coalesce(sum(cc.count), 0) from comment_claps cc where cc.comment_id = "comments"."id" and cc.user_id = ${viewerId})::int`
        : sql<number>`0`,
    })
    .from(comments)
    .innerJoin(user, eq(comments.userId, user.id))
    .where(
      and(
        eq(comments.postId, postId),
        eq(user.banned, false),
        viewerId
          ? sql`(${comments.status} = 'approved' or (${comments.userId} = ${viewerId} and ${comments.status} = 'pending'))`
          : eq(comments.status, "approved"),
        viewerId ? sql`"comments"."user_id" not in (select m.target_id from mutes m where m.user_id = ${viewerId} and m.target_type = 'user')` : undefined,
      ),
    )
    .orderBy(desc(comments.createdAt));
  return rows.map((r) => ({ ...r, clapCount: Number(r.clapCount), myClaps: Number(r.myClaps) }));
}

export async function listTopics(limit?: number) {
  const q = db
    .select({
      id: topics.id,
      slug: topics.slug,
      name: topics.name,
      description: topics.description,
      storyCount: sql<number>`(select count(*) from post_topics pt join posts p on p.id = pt.post_id where pt.topic_id = "topics"."id" and ${sql.raw(liveRawP)})::int`,
    })
    .from(topics)
    .orderBy(desc(sql`5`), topics.name);
  return limit ? q.limit(limit) : q;
}

/** Topics a reader follows, alphabetically. */
export async function followedTopics(userId: string | undefined) {
  if (!userId) return [];
  return db
    .select({ id: topics.id, slug: topics.slug, name: topics.name })
    .from(topicFollows)
    .innerJoin(topics, eq(topicFollows.topicId, topics.id))
    .where(eq(topicFollows.userId, userId))
    .orderBy(topics.name);
}

/** Followers per topic and whether this reader follows each one. */
export async function topicFollowInfo(userId: string | undefined) {
  const rows = await db.execute<{ topic_id: number; n: number; mine: boolean }>(sql`
    select topic_id, count(*)::int as n, bool_or(user_id = ${userId ?? ""}) as mine
    from topic_follows group by topic_id`);
  return new Map(rows.rows.map((r) => [Number(r.topic_id), { followers: Number(r.n), following: !!r.mine }]));
}

export async function getTopic(slug: string) {
  return db.query.topics.findFirst({ where: eq(topics.slug, slug) });
}

export async function whoToFollow(viewerId?: string, limit = 3) {
  const followed = viewerId
    ? (await db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, viewerId))).map(
        (r) => r.id,
      )
    : [];
  const exclude = viewerId ? [viewerId, ...followed] : [];
  return db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      bio: user.bio,
      stories: sql<number>`(select count(*) from posts p where p.author_id = "user"."id" and ${sql.raw(liveRawP)})::int`,
    })
    .from(user)
    .where(
      and(
        eq(user.banned, false),
        inArray(user.role, ["contributor", "author", "editor", "admin"]),
        exclude.length ? notInArray(user.id, exclude) : undefined,
      ),
    )
    .orderBy(desc(sql`6`))
    .limit(limit);
}

export async function getProfile(username: string, viewerId?: string) {
  const u = await db.query.user.findFirst({ where: eq(user.username, username) });
  if (!u || u.banned) return null;
  const [[followers], [following], viewerFollows] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followingId, u.id)),
    db.select({ n: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followerId, u.id)),
    viewerId
      ? db.query.follows.findFirst({ where: and(eq(follows.followerId, viewerId), eq(follows.followingId, u.id)) })
      : Promise.resolve(undefined),
  ]);
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? u.id,
    image: u.image,
    bio: u.bio,
    createdAt: u.createdAt,
    followers: followers.n,
    following: following.n,
    viewerFollows: !!viewerFollows,
  };
}

export async function listBookmarks(userId: string): Promise<StoryCardData[]> {
  const rows = await db
    .select({ ...cardColumns, savedAt: bookmarks.createdAt })
    .from(bookmarks)
    .innerJoin(posts, eq(bookmarks.postId, posts.id))
    .innerJoin(user, eq(posts.authorId, user.id))
    .where(and(eq(bookmarks.userId, userId), published))
    .orderBy(desc(bookmarks.createdAt));
  return attachTopics(rows);
}

/** Stories the reader saved anywhere: their reading list or any of their own lists. */
export async function bookmarkedIds(userId: string | undefined, postIds: string[]) {
  if (!userId || !postIds.length) return new Set<string>();
  const [a, b] = await Promise.all([
    db.select({ id: bookmarks.postId }).from(bookmarks).where(and(eq(bookmarks.userId, userId), inArray(bookmarks.postId, postIds))),
    db
      .select({ id: listItems.postId })
      .from(listItems)
      .innerJoin(lists, eq(listItems.listId, lists.id))
      .where(and(eq(lists.userId, userId), inArray(listItems.postId, postIds))),
  ]);
  return new Set([...a, ...b].map((r) => r.id));
}

export type MyStoriesTab = "drafts" | "published" | "trash";

const MY_TAB_STATUSES: Record<MyStoriesTab, string[]> = {
  drafts: ["draft", "pending"],
  published: ["published", "scheduled"],
  trash: ["trash"],
};

export async function listMyStories(userId: string, tab: MyStoriesTab) {
  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      status: posts.status,
      readingMinutes: posts.readingMinutes,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      clapCount,
      commentCount,
      viewCount,
    })
    .from(posts)
    .where(and(eq(posts.authorId, userId), inArray(posts.status, MY_TAB_STATUSES[tab])))
    .orderBy(desc(posts.updatedAt));
}

export async function myStoryCounts(userId: string) {
  const rows = await db
    .select({ status: posts.status, n: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.authorId, userId))
    .groupBy(posts.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  const sum = (tab: MyStoriesTab) => MY_TAB_STATUSES[tab].reduce((n, st) => n + (by[st] ?? 0), 0);
  return { drafts: sum("drafts"), published: sum("published"), trash: sum("trash") };
}

export async function getEditableStory(id: string) {
  const p = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { postTopics: { with: { topic: true } } },
  });
  if (!p) return null;
  return { ...p, topics: p.postTopics.map((pt) => pt.topic) };
}

export async function listRevisions(postId: string) {
  return db
    .select({
      id: postRevisions.id,
      title: postRevisions.title,
      createdAt: postRevisions.createdAt,
      savedByName: user.name,
    })
    .from(postRevisions)
    .leftJoin(user, eq(postRevisions.savedBy, user.id))
    .where(eq(postRevisions.postId, postId))
    .orderBy(desc(postRevisions.createdAt))
    .limit(30);
}

/** People who can be set as a story's author (contributor and above). */
export async function listWriters() {
  return db
    .select({ id: user.id, name: user.name, username: user.username, role: user.role })
    .from(user)
    .where(and(inArray(user.role, ["contributor", "author", "editor", "admin"]), eq(user.banned, false)))
    .orderBy(user.name);
}

/* ------------------------------ Admin ------------------------------ */

export async function adminStats() {
  const [[stories], [drafts], [pending], [users], [commentsN], [clapsN]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(posts).where(liveSql),
    db.select({ n: sql<number>`count(*)::int` }).from(posts).where(eq(posts.status, "draft")),
    db.select({ n: sql<number>`count(*)::int` }).from(posts).where(eq(posts.status, "pending")),
    db.select({ n: sql<number>`count(*)::int` }).from(user),
    db.select({ n: sql<number>`count(*)::int` }).from(comments),
    db.select({ n: sql<number>`coalesce(sum(${claps.count}),0)::int` }).from(claps),
  ]);
  return {
    stories: stories.n,
    drafts: drafts.n,
    pending: pending.n,
    users: users.n,
    comments: commentsN.n,
    claps: clapsN.n,
  };
}

export const ADMIN_POST_TABS = ["all", "published", "scheduled", "pending", "draft", "trash", "featured"] as const;
export type AdminPostTab = (typeof ADMIN_POST_TABS)[number];

function adminTabWhere(tab: AdminPostTab): SQL | undefined {
  switch (tab) {
    case "all":
      return sql`${posts.status} <> 'trash'`;
    case "featured":
      return and(eq(posts.featured, true), sql`${posts.status} <> 'trash'`);
    default:
      return eq(posts.status, tab);
  }
}

export async function adminPostCounts() {
  const rows = await db
    .select({ status: posts.status, featured: posts.featured, n: sql<number>`count(*)::int` })
    .from(posts)
    .groupBy(posts.status, posts.featured);
  const counts = Object.fromEntries(ADMIN_POST_TABS.map((t) => [t, 0])) as Record<AdminPostTab, number>;
  for (const r of rows) {
    if (r.status in counts) counts[r.status as AdminPostTab] += r.n;
    if (r.status !== "trash") counts.all += r.n;
    if (r.featured && r.status !== "trash") counts.featured += r.n;
  }
  return counts;
}

export const ADMIN_PAGE_SIZE = 25;

export async function adminListStories(opts: {
  tab: AdminPostTab;
  query?: string;
  authorId?: string;
  topicId?: number;
  page?: number;
}) {
  const where: (SQL | undefined)[] = [adminTabWhere(opts.tab)];
  if (opts.query) where.push(sql`${posts.title} ilike ${"%" + opts.query + "%"}`);
  if (opts.authorId) where.push(eq(posts.authorId, opts.authorId));
  if (opts.topicId) {
    where.push(sql`${posts.id} in (select ${postTopics.postId} from ${postTopics} where ${postTopics.topicId} = ${opts.topicId})`);
  }
  const page = Math.max(1, opts.page ?? 1);
  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      featured: posts.featured,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      trashedAt: posts.trashedAt,
      clapCount,
      commentCount,
      viewCount,
      authorName: user.name,
      authorUsername: user.username,
    })
    .from(posts)
    .innerJoin(user, eq(posts.authorId, user.id))
    .where(and(...where))
    .orderBy(desc(posts.updatedAt))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset((page - 1) * ADMIN_PAGE_SIZE);
  return { rows: rows.slice(0, ADMIN_PAGE_SIZE), hasMore: rows.length > ADMIN_PAGE_SIZE };
}

export async function adminListUsers(query?: string) {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      image: user.image,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
      stories: sql<number>`(select count(*) from posts p where p.author_id = "user"."id" and ${sql.raw(liveRawP)})::int`,
    })
    .from(user)
    .where(query ? sql`(${user.name} ilike ${"%" + query + "%"} or ${user.email} ilike ${"%" + query + "%"})` : undefined)
    .orderBy(desc(user.createdAt))
    .limit(200);
}

export const COMMENT_TABS = ["pending", "approved", "spam"] as const;
export type CommentTab = (typeof COMMENT_TABS)[number];

export async function adminCommentCounts() {
  const rows = await db.select({ status: comments.status, n: sql<number>`count(*)::int` }).from(comments).groupBy(comments.status);
  const counts = { pending: 0, approved: 0, spam: 0 } as Record<CommentTab, number>;
  for (const r of rows) if (r.status in counts) counts[r.status as CommentTab] = r.n;
  return counts;
}

export async function adminListComments(status: CommentTab = "pending", limit = 200) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      status: comments.status,
      createdAt: comments.createdAt,
      userName: user.name,
      username: user.username,
      userImage: user.image,
      postTitle: posts.title,
      postSlug: posts.slug,
    })
    .from(comments)
    .innerJoin(user, eq(comments.userId, user.id))
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(eq(comments.status, status))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
}

/* ----------------------------- Dashboard ---------------------------- */

/** Views per day for the last `days` days, oldest first, with zero-filled gaps. */
export async function viewsByDay(days = 30) {
  const rows = await db.execute<{ day: string; n: number }>(sql`
    select to_char(d, 'YYYY-MM-DD') as day, coalesce(sum(v.count), 0)::int as n
    from generate_series(current_date - ${days - 1}::int, current_date, interval '1 day') d
    left join post_views v on v.day = d::date
    group by d order by d`);
  return rows.rows.map((r) => ({ day: r.day, n: Number(r.n) }));
}

export async function topPosts(days = 30, limit = 5) {
  const rows = await db.execute<{ id: string; title: string; slug: string; n: number }>(sql`
    select p.id, p.title, p.slug, sum(v.count)::int as n
    from post_views v join posts p on p.id = v.post_id
    where v.day > current_date - ${days}::int
    group by p.id order by n desc limit ${limit}`);
  return rows.rows.map((r) => ({ ...r, n: Number(r.n) }));
}

export async function pendingReview(limit = 6) {
  return db
    .select({ id: posts.id, title: posts.title, updatedAt: posts.updatedAt, authorName: user.name })
    .from(posts)
    .innerJoin(user, eq(posts.authorId, user.id))
    .where(eq(posts.status, "pending"))
    .orderBy(desc(posts.updatedAt))
    .limit(limit);
}

/* ------------------------------------------------------------------ */
/* Admin → SEO                                                         */
/* ------------------------------------------------------------------ */

export const SEO_FILTERS = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "custom", label: "Custom" },
  { key: "hidden", label: "Hidden from search" },
] as const;
export type SeoFilter = (typeof SEO_FILTERS)[number]["key"];

export type SeoRow = {
  id: string;
  kind: "story" | "page";
  title: string;
  slug: string;
  status: string;
  live: boolean;
  authorName: string | null;
  seoTitle: string;
  seoDescription: string;
  noindex: boolean;
  canonicalUrl: string;
  shareImage: string;
  autoTitle: string;
  autoDescription: string;
  autoImage: string | null;
  effectiveTitle: string;
  effectiveDescription: string;
  custom: boolean;
  topicCount: number | null;
  passed: number;
  total: number;
};

function seoRow(
  r: {
    id: string;
    title: string;
    subtitle?: string | null;
    excerpt?: string | null;
    coverImage?: string | null;
    slug: string;
    status: string;
    publishedAt?: Date | null;
    authorName?: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    noindex: boolean;
    canonicalUrl?: string | null;
    shareImage?: string | null;
    topicCount?: number | null;
  },
  kind: "story" | "page",
  defaultImage: string | null,
): SeoRow {
  const e = effectiveSeo(r, defaultImage);
  const checks = seoChecks({
    title: e.title,
    description: e.description,
    hasImage: !!e.image,
    topicCount: kind === "story" ? (r.topicCount ?? 0) : undefined,
    slug: kind === "story" && !r.slug.startsWith("draft-") ? r.slug : null,
    noindex: r.noindex,
  });
  const { passed, total } = seoScore(checks);
  return {
    id: r.id,
    kind,
    title: r.title || "Untitled",
    slug: r.slug,
    status: r.status,
    live: kind === "story" ? isLive({ status: r.status, publishedAt: r.publishedAt ?? null }) : r.status === "published",
    authorName: r.authorName ?? null,
    seoTitle: r.seoTitle ?? "",
    seoDescription: r.seoDescription ?? "",
    noindex: r.noindex,
    canonicalUrl: r.canonicalUrl ?? "",
    shareImage: r.shareImage ?? "",
    autoTitle: e.autoTitle,
    autoDescription: e.autoDescription,
    autoImage: e.autoImage,
    effectiveTitle: e.title,
    effectiveDescription: e.description,
    custom: e.customTitle || e.customDescription || e.customImage,
    topicCount: kind === "story" ? (r.topicCount ?? 0) : null,
    passed,
    total,
  };
}

function filterSeo(rows: SeoRow[], filter: SeoFilter, query: string) {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !`${r.title} ${r.effectiveTitle} ${r.slug}`.toLowerCase().includes(q)) return false;
    if (filter === "attention") return r.passed < r.total;
    if (filter === "custom") return r.custom;
    if (filter === "hidden") return r.noindex;
    return true;
  });
}

/** Every story (except trash) and page with its automatic and custom SEO, scored and filtered. */
export async function adminListSeo(opts: { kind: "stories" | "pages"; filter: SeoFilter; query?: string; page?: number; defaultImage: string | null }) {
  const PER = 25;
  let rows: SeoRow[];
  if (opts.kind === "stories") {
    const raw = await db
      .select({
        id: posts.id,
        title: posts.title,
        subtitle: posts.subtitle,
        excerpt: posts.excerpt,
        coverImage: posts.coverImage,
        slug: posts.slug,
        status: posts.status,
        publishedAt: posts.publishedAt,
        authorName: user.name,
        seoTitle: posts.seoTitle,
        seoDescription: posts.seoDescription,
        noindex: posts.noindex,
        canonicalUrl: posts.canonicalUrl,
        shareImage: posts.shareImage,
        topicCount: sql<number>`(select count(*) from post_topics pt where pt.post_id = "posts"."id")::int`,
      })
      .from(posts)
      .innerJoin(user, eq(posts.authorId, user.id))
      .where(ne(posts.status, "trash"))
      .orderBy(desc(posts.updatedAt))
      .limit(2000);
    rows = raw.map((r) => seoRow(r, "story", opts.defaultImage));
  } else {
    const raw = await db
      .select({
        id: pages.id,
        title: pages.title,
        content: pages.content,
        slug: pages.slug,
        status: pages.status,
        seoTitle: pages.seoTitle,
        seoDescription: pages.seoDescription,
        noindex: pages.noindex,
      })
      .from(pages)
      .orderBy(pages.title);
    rows = raw.map(({ content, ...r }) => seoRow({ ...r, excerpt: storyText(content as JSONContent) }, "page", opts.defaultImage));
  }
  const counts = Object.fromEntries(SEO_FILTERS.map((f) => [f.key, filterSeo(rows, f.key, "").length])) as Record<SeoFilter, number>;
  const filtered = filterSeo(rows, opts.filter, opts.query ?? "");
  const page = Math.max(1, opts.page ?? 1);
  return { rows: filtered.slice((page - 1) * PER, page * PER), hasMore: filtered.length > page * PER, total: filtered.length, counts };
}

/** Topics with their SEO overrides and automatic fallbacks. */
export async function adminListTopicSeo() {
  const rows = await db.select().from(topics).orderBy(topics.name);
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    seoTitle: t.seoTitle ?? "",
    seoDescription: t.seoDescription ?? "",
    autoTitle: t.name,
    autoDescription: clip(t.description, DESCRIPTION_MAX) || `Stories about ${t.name}.`,
  }));
}

/** Number of stories whose SEO checklist isn't complete, for the dashboard. */
export async function seoAttentionCount(defaultImage: string | null) {
  const { counts } = await adminListSeo({ kind: "stories", filter: "attention", defaultImage });
  return counts.attention;
}


/* ------------------------------------------------------------------ */
/* Library: lists, highlights, reading history                         */
/* ------------------------------------------------------------------ */

export type ListSummary = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  count: number;
  covers: string[];
  owner: { name: string; username: string | null; image: string | null };
  updatedAt: Date;
};

async function summarizeLists(where: SQL | undefined, extraJoin?: "saves", saverId?: string): Promise<ListSummary[]> {
  const base = db
    .select({
      id: lists.id,
      name: lists.name,
      description: lists.description,
      isPublic: lists.isPublic,
      updatedAt: lists.updatedAt,
      ownerName: user.name,
      ownerUsername: user.username,
      ownerImage: user.image,
      count: sql<number>`(select count(*) from list_items li join posts p on p.id = li.post_id where li.list_id = "lists"."id" and ${sql.raw(liveRawP)})::int`,
      covers: sql<string[]>`array(select p.cover_image from list_items li join posts p on p.id = li.post_id where li.list_id = "lists"."id" and p.cover_image is not null and ${sql.raw(liveRawP)} order by li.created_at desc limit 3)`,
    })
    .from(lists)
    .innerJoin(user, eq(lists.userId, user.id));
  const rows =
    extraJoin === "saves" && saverId
      ? await base
          .innerJoin(listSaves, and(eq(listSaves.listId, lists.id), eq(listSaves.userId, saverId)))
          .where(and(where, eq(lists.isPublic, true)))
          .orderBy(desc(listSaves.createdAt))
      : await base.where(where).orderBy(desc(lists.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isPublic: r.isPublic,
    count: Number(r.count),
    covers: r.covers ?? [],
    owner: { name: r.ownerName, username: r.ownerUsername, image: r.ownerImage },
    updatedAt: r.updatedAt,
  }));
}

/** The reader's own lists, plus the size and covers of their default reading list. */
export async function myLists(userId: string) {
  const [own, reading] = await Promise.all([
    summarizeLists(eq(lists.userId, userId)),
    db.execute<{ n: number; covers: string[] }>(sql`
      select count(*)::int as n,
        (array_agg(p.cover_image order by b.created_at desc) filter (where p.cover_image is not null))[1:3] as covers
      from bookmarks b join posts p on p.id = b.post_id
      where b.user_id = ${userId} and ${sql.raw(liveRawP)}`),
  ]);
  return { own, reading: { count: Number(reading.rows[0]?.n ?? 0), covers: reading.rows[0]?.covers ?? [] } };
}

export async function savedLists(userId: string) {
  return summarizeLists(undefined, "saves", userId);
}

export async function publicListsOf(userId: string) {
  return summarizeLists(and(eq(lists.userId, userId), eq(lists.isPublic, true)));
}

/** A list with its stories, or null when it doesn't exist or is private to someone else. */
export async function getList(id: string, viewerId?: string) {
  const [summary] = await summarizeLists(eq(lists.id, id));
  if (!summary) return null;
  const owner = await db.query.lists.findFirst({ where: eq(lists.id, id), columns: { userId: true } });
  const isOwner = !!viewerId && owner?.userId === viewerId;
  if (!summary.isPublic && !isOwner) return null;
  const rows = await db
    .select({ ...cardColumns, addedAt: listItems.createdAt })
    .from(listItems)
    .innerJoin(posts, eq(listItems.postId, posts.id))
    .innerJoin(user, eq(posts.authorId, user.id))
    .where(and(eq(listItems.listId, id), published))
    .orderBy(desc(listItems.createdAt));
  const saved = viewerId
    ? !!(await db.query.listSaves.findFirst({ where: and(eq(listSaves.userId, viewerId), eq(listSaves.listId, id)) }))
    : false;
  return { ...summary, isOwner, saved, stories: await attachTopics(rows) };
}

export async function myHighlights(userId: string) {
  return db
    .select({ id: highlights.id, text: highlights.text, createdAt: highlights.createdAt, slug: posts.slug, title: posts.title, authorName: user.name })
    .from(highlights)
    .innerJoin(posts, eq(highlights.postId, posts.id))
    .innerJoin(user, eq(posts.authorId, user.id))
    .where(and(eq(highlights.userId, userId), published))
    .orderBy(desc(highlights.createdAt))
    .limit(200);
}

export async function myHistory(userId: string, limit = 50) {
  const rows = await db
    .select({ ...cardColumns, readAt: readingHistory.readAt })
    .from(readingHistory)
    .innerJoin(posts, eq(readingHistory.postId, posts.id))
    .innerJoin(user, eq(posts.authorId, user.id))
    .where(and(eq(readingHistory.userId, userId), published))
    .orderBy(desc(readingHistory.readAt))
    .limit(limit);
  return attachTopics(rows);
}

export type StoryHighlight = { id: string; text: string; prefix: string; suffix: string; mine: boolean; top?: boolean; count?: number };

/** The reader's own highlights on a story, plus the most-highlighted passage once 3+ readers chose it. */
export async function storyHighlights(postId: string, viewerId?: string): Promise<StoryHighlight[]> {
  const mine = viewerId
    ? await db
        .select({ id: highlights.id, text: highlights.text, prefix: highlights.prefix, suffix: highlights.suffix })
        .from(highlights)
        .where(and(eq(highlights.postId, postId), eq(highlights.userId, viewerId)))
    : [];
  const top = await db.execute<{ text: string; prefix: string; suffix: string; n: number }>(sql`
    select text, min(prefix) as prefix, min(suffix) as suffix, count(distinct user_id)::int as n
    from highlights where post_id = ${postId}
    group by text having count(distinct user_id) >= 3
    order by n desc limit 1`);
  const out: StoryHighlight[] = mine.map((h) => ({ ...h, mine: true }));
  const t = top.rows[0];
  if (t && !mine.some((h) => h.text === t.text)) out.push({ id: "top", text: t.text, prefix: t.prefix, suffix: t.suffix, mine: false, top: true, count: Number(t.n) });
  else if (t) {
    const m = out.find((h) => h.text === t.text);
    if (m) Object.assign(m, { top: true, count: Number(t.n) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Admin → Reports                                                     */
/* ------------------------------------------------------------------ */

export type ReportRow = {
  id: string;
  reason: string;
  note: string | null;
  status: string;
  createdAt: Date;
  reporterName: string;
  reporterUsername: string | null;
  post: { id: string; slug: string; title: string; status: string } | null;
  comment: { id: string; body: string; status: string; authorName: string; postSlug: string } | null;
  others: number;
};

export async function adminListReports(status: "open" | "closed", limit = 100): Promise<ReportRow[]> {
  const rows = await db.execute<{
    id: string; reason: string; note: string | null; status: string; created_at: Date;
    reporter_name: string; reporter_username: string | null;
    post_id: string | null; post_slug: string | null; post_title: string | null; post_status: string | null;
    comment_id: string | null; comment_body: string | null; comment_status: string | null; comment_author: string | null; comment_post_slug: string | null;
    others: number;
  }>(sql`
    select r.id, r.reason, r.note, r.status, r.created_at,
      u.name as reporter_name, u.username as reporter_username,
      p.id as post_id, p.slug as post_slug, p.title as post_title, p.status as post_status,
      c.id as comment_id, c.body as comment_body, c.status as comment_status, cu.name as comment_author, cp.slug as comment_post_slug,
      (select count(*) from reports r2 where r2.status = r.status and r2.id <> r.id
        and (r2.post_id = r.post_id or r2.comment_id = r.comment_id))::int as others
    from reports r
    join "user" u on u.id = r.reporter_id
    left join posts p on p.id = r.post_id
    left join comments c on c.id = r.comment_id
    left join "user" cu on cu.id = c.user_id
    left join posts cp on cp.id = c.post_id
    where ${status === "open" ? sql`r.status = 'open'` : sql`r.status <> 'open'`}
    order by r.created_at desc
    limit ${limit}`);
  return rows.rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    note: r.note,
    status: r.status,
    createdAt: new Date(r.created_at),
    reporterName: r.reporter_name,
    reporterUsername: r.reporter_username,
    post: r.post_id ? { id: r.post_id, slug: r.post_slug!, title: r.post_title || "Untitled story", status: r.post_status! } : null,
    comment: r.comment_id ? { id: r.comment_id, body: r.comment_body!, status: r.comment_status!, authorName: r.comment_author ?? "", postSlug: r.comment_post_slug ?? "" } : null,
    others: Number(r.others),
  }));
}

export async function openReportCount() {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(reports).where(eq(reports.status, "open"));
  return row?.n ?? 0;
}
