import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StoryList } from "@/components/blog/story-card";
import { db } from "@/db";
import { user } from "@/db/schema";
import { bookmarkedIds, listStories, listTopics } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { and, eq, ilike, or } from "drizzle-orm";

export const metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, 100);
  const me = await getCurrentUser();
  const [stories, topics, people] = q
    ? await Promise.all([
        listStories({ query: q, limit: 20, viewerId: me?.id }),
        listTopics().then((ts) => ts.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))),
        db
          .select({ id: user.id, name: user.name, username: user.username, image: user.image, bio: user.bio })
          .from(user)
          .where(and(eq(user.banned, false), or(ilike(user.name, `%${q}%`), ilike(user.username, `%${q}%`))))
          .limit(5),
      ])
    : [[], [], []];
  const saved = await bookmarkedIds(me?.id, stories.map((s) => s.id));

  return (
    <main className="mx-auto max-w-feed px-4 pb-16 pt-10 sm:px-6">
      <form action="/search" className="flex items-center gap-3 rounded-pill bg-surface px-5 py-3">
        <Search size={20} className="text-muted" aria-hidden />
        <label htmlFor="q" className="sr-only">Search stories, people and topics</label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={!q}
          placeholder="Search stories, people and topics"
          className="w-full bg-transparent text-lg outline-none placeholder:text-muted"
        />
      </form>

      {q ? (
        <>
          <h1 className="mt-10 text-3xl font-bold tracking-tight">
            <span className="text-muted">Results for</span> {q}
          </h1>
          {topics.length ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {topics.map((t) => (
                <Chip key={t.id} href={`/tag/${t.slug}`}>{t.name}</Chip>
              ))}
            </div>
          ) : null}
          {people.length ? (
            <div className="mt-8 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted">People</h2>
              {people.map((p) => (
                <Link key={p.id} href={`/@${p.username}`} className="flex items-center gap-3">
                  <Avatar name={p.name} src={p.image} size="sm" />
                  <span className="min-w-0">
                    <span className="block font-medium">{p.name}</span>
                    {p.bio ? <span className="block truncate text-xs text-muted">{p.bio}</span> : null}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
          <div className="mt-6">
            {stories.length ? (
              <StoryList stories={stories} savedIds={saved} signedIn={!!me} />
            ) : (
              <div className="py-8">
                <EmptyState title="No stories found">Try different words, or browse by topic.</EmptyState>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="mt-10 text-center text-muted">Search for a story title, a writer or a topic.</p>
      )}
    </main>
  );
}
