import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { FollowButton } from "@/components/blog/follow-button";
import { listStories, listTopics, whoToFollow } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export async function Sidebar() {
  const me = await getCurrentUser();
  const [picks, topics, people] = await Promise.all([
    listStories({ featured: true, limit: 3 }),
    listTopics(8),
    whoToFollow(me?.id, 3),
  ]);
  return (
    <div className="sticky top-[97px] flex flex-col gap-10">
      {picks.length ? (
        <section>
          <h3 className="mb-4 font-semibold">Editor&apos;s picks</h3>
          <div className="flex flex-col gap-5">
            {picks.map((p) => (
              <div key={p.id}>
                <Link href={`/@${p.author.username}`} className="flex items-center gap-2 text-xs font-medium">
                  <Avatar name={p.author.name} src={p.author.image} size="xs" />
                  {p.author.name}
                </Link>
                <Link href={`/p/${p.slug}`} className="mt-2 block font-bold leading-5 hover:underline">
                  {p.title}
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {topics.length ? (
        <section>
          <h3 className="mb-4 font-semibold">Recommended topics</h3>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <Chip key={t.id} href={`/tag/${t.slug}`}>
                {t.name}
              </Chip>
            ))}
          </div>
          <Link href="/topics" className="mt-4 inline-block text-sm text-accent hover:underline">
            See all topics
          </Link>
        </section>
      ) : null}

      {people.length ? (
        <section>
          <h3 className="mb-4 font-semibold">Who to follow</h3>
          <div className="flex flex-col gap-4">
            {people.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <Link href={`/@${p.username}`}>
                  <Avatar name={p.name} src={p.image} size="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/@${p.username}`} className="block truncate font-semibold hover:underline">
                    {p.name}
                  </Link>
                  <p className="truncate text-xs text-muted">{p.bio || `${p.stories} stories`}</p>
                </div>
                <FollowButton userId={p.id} following={false} signedIn={!!me} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <SiteFooterLinks />
    </div>
  );
}

export function SiteFooterLinks() {
  return (
    <nav className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted">
      <Link href="/about" className="hover:text-fg">About</Link>
      <Link href="/topics" className="hover:text-fg">Topics</Link>
      <Link href="/design" className="hover:text-fg">Design system</Link>
      <Link href="/privacy" className="hover:text-fg">Privacy</Link>
      <Link href="/terms" className="hover:text-fg">Terms</Link>
    </nav>
  );
}
