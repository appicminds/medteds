import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  index,
  serial,
  date,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

/* ------------------------------------------------------------------ */
/* Auth tables (shape required by Better Auth)                         */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // MedTeds profile fields
  username: text("username").unique(),
  bio: text("bio"),
  // "subscriber" | "contributor" | "author" | "editor" | "admin" (see src/lib/permissions.ts)
  role: text("role").notNull().default("subscriber"),
  banned: boolean("banned").notNull().default(false),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Topics a reader follows; they shape the topic bar and the "For you" feed. */
export const topicFollows = pgTable(
  "topic_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topicId] }), index("topic_follows_topic_idx").on(t.topicId)],
);

export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    subtitle: text("subtitle"),
    slug: text("slug").notNull().unique(),
    content: jsonb("content"), // Tiptap JSON document
    excerpt: text("excerpt"),
    coverImage: text("cover_image"),
    // "draft" | "pending" (awaiting review) | "scheduled" | "published" | "trash"
    status: text("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false), // editor's pick
    readingMinutes: integer("reading_minutes").notNull().default(1),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    noindex: boolean("noindex").notNull().default(false), // hide from search engines
    canonicalUrl: text("canonical_url"), // original address when first published elsewhere
    shareImage: text("share_image"), // custom social sharing image; blank uses the cover
    publishedAt: timestamp("published_at"),
    trashedAt: timestamp("trashed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("posts_author_idx").on(t.authorId),
    index("posts_status_published_idx").on(t.status, t.publishedAt),
  ],
);

export const postTopics = pgTable(
  "post_topics",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.topicId] })],
);

export const claps = pgTable(
  "claps",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    status: text("status").notNull().default("approved"), // "approved" | "pending" | "spam"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("comments_post_idx").on(t.postId), index("comments_status_idx").on(t.status)],
);

/** Daily view counts per story. */
export const postViews = pgTable(
  "post_views",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.day] }), index("post_views_day_idx").on(t.day)],
);

/** Single-use invitations that give a new account a role. */
export const invites = pgTable("invites", {
  id: text("id").primaryKey(), // also the secret token in the invite link
  email: text("email").notNull(),
  role: text("role").notNull(),
  invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);

export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_following_idx").on(t.followingId),
  ],
);

/** Snapshots of a story, saved on publish/update and on demand, for restoring older versions. */
export const postRevisions = pgTable(
  "post_revisions",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    savedBy: text("saved_by").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    subtitle: text("subtitle"),
    content: jsonb("content"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("post_revisions_post_idx").on(t.postId, t.createdAt)],
);

/** Static pages such as About, Privacy and Terms, edited in Admin → Pages. */
export const pages = pgTable("pages", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull().default(""),
  content: jsonb("content"),
  status: text("status").notNull().default("draft"), // "draft" | "published"
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  noindex: boolean("noindex").notNull().default(false),
  authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Site-wide settings, stored as one JSON value per key (see src/lib/settings.ts). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Media library: one row per uploaded image. Bytes live in `data` when stored in Postgres,
 * or in Supabase Storage (then `data` is null and `url` points there).
 */
export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    url: text("url").notNull().default(""),
    filename: text("filename").notNull().default(""),
    alt: text("alt").notNull().default(""),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    storage: text("storage").notNull().default("db"), // "db" | "supabase"
    data: bytea("data"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("media_created_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const userRelations = relations(user, ({ many }) => ({
  posts: many(posts),
}));

export const postRelations = relations(posts, ({ one, many }) => ({
  author: one(user, { fields: [posts.authorId], references: [user.id] }),
  postTopics: many(postTopics),
}));

export const postTopicRelations = relations(postTopics, ({ one }) => ({
  post: one(posts, { fields: [postTopics.postId], references: [posts.id] }),
  topic: one(topics, { fields: [postTopics.topicId], references: [topics.id] }),
}));

export const topicRelations = relations(topics, ({ many }) => ({
  postTopics: many(postTopics),
}));

export type User = typeof user.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Page = typeof pages.$inferSelect;
