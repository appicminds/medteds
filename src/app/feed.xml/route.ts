import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { posts, user } from "@/db/schema";
import { liveSql } from "@/lib/live";
import { absoluteUrl } from "@/lib/seo";
import { effectiveSeo } from "@/lib/seo-auto";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Characters XML 1.0 doesn't allow.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** RSS 2.0 feed of the latest live stories. */
export async function GET() {
  const settings = await getSettings();
  const rows = await db
    .select({
      title: posts.title,
      subtitle: posts.subtitle,
      excerpt: posts.excerpt,
      seoDescription: posts.seoDescription,
      seoTitle: posts.seoTitle,
      slug: posts.slug,
      publishedAt: posts.publishedAt,
      authorName: user.name,
    })
    .from(posts)
    .innerJoin(user, eq(posts.authorId, user.id))
    .where(and(liveSql, eq(user.banned, false)))
    .orderBy(desc(posts.publishedAt))
    .limit(30);

  const home = absoluteUrl("/");
  const items = rows
    .map((r) => {
      const link = absoluteUrl(`/p/${r.slug}`);
      const description = effectiveSeo(r).description;
      return [
        "    <item>",
        `      <title>${esc(r.title || "Untitled story")}</title>`,
        `      <link>${esc(link)}</link>`,
        `      <guid isPermaLink="true">${esc(link)}</guid>`,
        description ? `      <description>${esc(description)}</description>` : "",
        `      <dc:creator>${esc(r.authorName)}</dc:creator>`,
        r.publishedAt ? `      <pubDate>${r.publishedAt.toUTCString()}</pubDate>` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${esc(settings.siteName)}</title>
    <link>${esc(home)}</link>
    <description>${esc(settings.tagline || settings.siteName)}</description>
    <language>en</language>
    <atom:link href="${esc(absoluteUrl("/feed.xml"))}" rel="self" type="application/rss+xml" />
${rows[0]?.publishedAt ? `    <lastBuildDate>${rows[0].publishedAt.toUTCString()}</lastBuildDate>\n` : ""}${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600" },
  });
}
