import "server-only";
import { and, desc, eq, sql, inArray, notInArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks, claps, comments, follows, postRevisions, postTopics, posts, topics, user } from "@/db/schema";
import { liveRawP, liveSql } from "@/lib/live";

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
  let order: SQL[] = [desc(posts.publishedAt)];
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
      db.query.bookmarks.findFirst({ where: and(eq(bookmarks.userId, viewerId), eq(bookmarks.postId, card.id)) }),
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
    authorBio: row.authorBio,
    authorBanned: row.authorBanned,
    authorFollowers: followers?.n ?? 0,
    viewer,
  };
}

/** Approved responses, plus the viewer's own responses that are waiting for approval. */
export async function getComments(postId: string, viewerId?: string) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      status: comments.status,
      createdAt: comments.createdAt,
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
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
      ),
    )
    .orderBy(desc(comments.createdAt));
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

export async function bookmarkedIds(userId: string | undefined, postIds: string[]) {
  if (!userId || !postIds.length) return new Set<string>();
  const rows = await db
    .select({ id: bookmarks.postId })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.postId, postIds)));
  return new Set(rows.map((r) => r.id));
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
