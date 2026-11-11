import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Pager } from "@/components/blog/pager";
import { StoryList } from "@/components/blog/story-card";
import { bookmarkedIds, getTopic, listStories, listTopics } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { alternatesFor } from "@/lib/seo";

const PAGE_SIZE = 10;

export async function generateMetadata({ params }: PageProps<"/tag/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTopic(slug);
  return t
    ? { title: t.name, description: t.description ?? undefined, alternates: alternatesFor(`/tag/${t.slug}`) }
    : { title: "Topic not found", robots: { index: false, follow: false } };
}

export default async function TopicPage({ params, searchParams }: PageProps<"/tag/[slug]">) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const topic = await getTopic(slug);
  if (!topic) notFound();
  const me = await getCurrentUser();
  const [stories, all] = await Promise.all([
    listStories({ topicSlug: slug, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE }),
    listTopics(),
  ]);
  const shown = stories.slice(0, PAGE_SIZE);
  const saved = await bookmarkedIds(me?.id, shown.map((s) => s.id));
  const count = all.find((t) => t.slug === slug)?.storyCount ?? 0;
  const related = all.filter((t) => t.slug !== slug).slice(0, 6);

  return (
    <main className="mx-auto max-w-feed px-4 pb-16 pt-12 sm:px-6">
      <header className="flex flex-col items-center gap-3 border-b border-line pb-10 text-center">
        <p className="text-xs uppercase tracking-[0.12em] text-muted">Topic</p>
        <h1 className="text-4xl font-bold tracking-tight">{topic.name}</h1>
        {topic.description ? <p className="max-w-md text-muted">{topic.description}</p> : null}
        <p className="text-sm text-muted">{count} {count === 1 ? "story" : "stories"}</p>
        {related.length ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {related.map((t) => (
              <Chip key={t.id} href={`/tag/${t.slug}`}>
                {t.name}
              </Chip>
            ))}
          </div>
        ) : null}
      </header>
      {shown.length ? (
        <>
          <StoryList stories={shown} savedIds={saved} signedIn={!!me} />
          <Pager page={page} hasMore={stories.length > PAGE_SIZE} base={`/tag/${slug}?`} />
        </>
      ) : (
        <div className="py-12">
          <EmptyState title={`No ${topic.name} stories yet`} action={<ButtonLink href="/write" variant="accent">Write the first one</ButtonLink>} />
        </div>
      )}
    </main>
  );
}
