import "server-only";
import { and, desc, eq, sql, inArray, notInArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks, claps, comments, follows, postTopics, posts, topics, user } from "@/db/schema";

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
const commentCount = sql<number>`(select count(*) from comments cm where cm.post_id = "posts"."id")::int`;

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

const published = and(eq(posts.status, "published"), eq(user.banned, false));

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
    authorBio: row.authorBio,
    authorBanned: row.authorBanned,
    authorFollowers: followers?.n ?? 0,
    viewer,
  };
}

export async function getComments(postId: string) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
    })
    .from(comments)
    .innerJoin(user, eq(comments.userId, user.id))
    .where(and(eq(comments.postId, postId), eq(user.banned, false)))
    .orderBy(desc(comments.createdAt));
}

export async function listTopics(limit?: number) {
  const q = db
    .select({
      id: topics.id,
      slug: topics.slug,
      name: topics.name,
      description: topics.description,
      storyCount: sql<number>`(select count(*) from post_topics pt join posts p on p.id = pt.post_id where pt.topic_id = "topics"."id" and p.status = 'published')::int`,
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
      stories: sql<number>`(select count(*) from posts p where p.author_id = "user"."id" and p.status = 'published')::int`,
    })
    .from(user)
    .where(and(eq(user.banned, false), exclude.length ? notInArray(user.id, exclude) : undefined))
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

export async function listMyStories(userId: string, status: "draft" | "published") {
  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      readingMinutes: posts.readingMinutes,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      clapCount,
      commentCount,
    })
    .from(posts)
    .where(and(eq(posts.authorId, userId), eq(posts.status, status)))
    .orderBy(desc(posts.updatedAt));
}

export async function getEditableStory(id: string, userId: string, isAdmin: boolean) {
  const p = await db.query.posts.findFirst({
    where: isAdmin ? eq(posts.id, id) : and(eq(posts.id, id), eq(posts.authorId, userId)),
    with: { postTopics: { with: { topic: true } } },
  });
  if (!p) return null;
  return { ...p, topics: p.postTopics.map((pt) => pt.topic) };
}

/* ------------------------------ Admin ------------------------------ */

export async function adminStats() {
  const [[stories], [drafts], [users], [commentsN], [clapsN]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(posts).where(eq(posts.status, "published")),
    db.select({ n: sql<number>`count(*)::int` }).from(posts).where(eq(posts.status, "draft")),
    db.select({ n: sql<number>`count(*)::int` }).from(user),
    db.select({ n: sql<number>`count(*)::int` }).from(comments),
    db.select({ n: sql<number>`coalesce(sum(${claps.count}),0)::int` }).from(claps),
  ]);
  return {
    stories: stories.n,
    drafts: drafts.n,
    users: users.n,
    comments: commentsN.n,
    claps: clapsN.n,
  };
}

export async function adminListStories(opts: { status?: string; query?: string }) {
  const where: (SQL | undefined)[] = [];
  if (opts.status === "featured") where.push(eq(posts.featured, true));
  else if (opts.status) where.push(eq(posts.status, opts.status));
  if (opts.query) where.push(sql`${posts.title} ilike ${"%" + opts.query + "%"}`);
  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      featured: posts.featured,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      clapCount,
      commentCount,
      authorName: user.name,
      authorUsername: user.username,
    })
    .from(posts)
    .innerJoin(user, eq(posts.authorId, user.id))
    .where(and(...where))
    .orderBy(desc(posts.updatedAt))
    .limit(200);
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
      stories: sql<number>`(select count(*) from posts p where p.author_id = "user"."id" and p.status = 'published')::int`,
    })
    .from(user)
    .where(query ? sql`(${user.name} ilike ${"%" + query + "%"} or ${user.email} ilike ${"%" + query + "%"})` : undefined)
    .orderBy(desc(user.createdAt))
    .limit(200);
}

export async function adminListComments() {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userName: user.name,
      username: user.username,
      postTitle: posts.title,
      postSlug: posts.slug,
    })
    .from(comments)
    .innerJoin(user, eq(comments.userId, user.id))
    .innerJoin(posts, eq(comments.postId, posts.id))
    .orderBy(desc(comments.createdAt))
    .limit(200);
}

