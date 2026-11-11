import { sql } from "drizzle-orm";
import { posts } from "@/db/schema";

/**
 * A story is live (publicly visible) when it is published, or scheduled with a publish time
 * that has passed. Scheduled posts therefore go live on time without any background job.
 */
export const liveSql = sql`(${posts.status} = 'published' or (${posts.status} = 'scheduled' and ${posts.publishedAt} <= now()))`;

/** Same rule for raw subqueries that alias the posts table as `p`. */
export const liveRawP = `(p.status = 'published' or (p.status = 'scheduled' and p.published_at <= now()))`;

export function isLive(post: { status: string; publishedAt: Date | null }) {
  return post.status === "published" || (post.status === "scheduled" && !!post.publishedAt && post.publishedAt <= new Date());
}
