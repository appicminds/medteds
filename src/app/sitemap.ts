import type { MetadataRoute } from "next";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pages, posts, user } from "@/db/schema";
import { liveRawP, liveSql } from "@/lib/live";
import { absoluteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/settings";

// Built on each request so new stories appear straight away.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSettings();
  if (!settings.searchVisible) return [];

  const [stories, sitePages, topicRows, writers] = await Promise.all([
    db
      .select({ slug: posts.slug, updatedAt: posts.updatedAt, coverImage: posts.coverImage })
      .from(posts)
      .innerJoin(user, eq(posts.authorId, user.id))
      .where(and(liveSql, eq(posts.noindex, false), eq(user.banned, false)))
      .orderBy(desc(posts.publishedAt))
      .limit(5000),
    db
      .select({ slug: pages.slug, updatedAt: pages.updatedAt })
      .from(pages)
      .where(and(eq(pages.status, "published"), eq(pages.noindex, false))),
    db.execute<{ slug: string; updated: Date | string | null }>(sql.raw(
      `select t.slug, max(p.updated_at) as updated from topics t
       join post_topics pt on pt.topic_id = t.id join posts p on p.id = pt.post_id
       where ${liveRawP} and p.noindex = false group by t.slug`,
    )),
    db.execute<{ username: string; updated: Date | string | null }>(sql.raw(
      `select u.username, max(p.updated_at) as updated from "user" u join posts p on p.author_id = u.id
       where ${liveRawP} and p.noindex = false and u.banned = false and u.username is not null group by u.username`,
    )),
  ]);

  const date = (v: Date | string | null) => (v ? new Date(v) : undefined);
  const latest = stories[0]?.updatedAt;

  return [
    { url: absoluteUrl("/"), lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/topics"), lastModified: latest, changeFrequency: "weekly", priority: 0.5 },
    ...stories.map((s) => ({
      url: absoluteUrl(`/p/${s.slug}`),
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: s.coverImage ? [absoluteUrl(s.coverImage)] : undefined,
    })),
    ...sitePages.map((p) => ({ url: absoluteUrl(`/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...topicRows.rows.map((t) => ({ url: absoluteUrl(`/tag/${t.slug}`), lastModified: date(t.updated), changeFrequency: "daily" as const, priority: 0.6 })),
    ...writers.rows.map((w) => ({ url: absoluteUrl(`/@${w.username}`), lastModified: date(w.updated), changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
