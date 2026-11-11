import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { posts, postViews } from "@/db/schema";
import { isLive } from "@/lib/live";
import { getCurrentUser } from "@/lib/session";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;
const REPEAT_WINDOW_SECONDS = 30 * 60;

/** Counts one view of a story. The same browser is counted at most once every 30 minutes. */
export async function POST(request: Request) {
  const { postId } = (await request.json().catch(() => ({}))) as { postId?: string };
  if (!postId || typeof postId !== "string" || postId.length > 40) return new NextResponse(null, { status: 204 });
  if (BOT.test(request.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });

  const cookieName = `mt_v_${postId.replace(/[^a-z0-9]/gi, "")}`;
  if ((request.headers.get("cookie") ?? "").includes(`${cookieName}=1`)) return new NextResponse(null, { status: 204 });

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    columns: { id: true, authorId: true, status: true, publishedAt: true },
  });
  if (!post || !isLive(post)) return new NextResponse(null, { status: 204 });
  const me = await getCurrentUser();
  if (me?.id === post.authorId) return new NextResponse(null, { status: 204 });

  await db
    .insert(postViews)
    .values({ postId, day: sql`current_date`, count: 1 })
    .onConflictDoUpdate({ target: [postViews.postId, postViews.day], set: { count: sql`${postViews.count} + 1` } });

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(cookieName, "1", { maxAge: REPEAT_WINDOW_SECONDS, httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
