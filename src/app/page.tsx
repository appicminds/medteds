import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Sidebar } from "@/components/blog/sidebar";
import { StoryList } from "@/components/blog/story-card";
import { Pager } from "@/components/blog/pager";
import { bookmarkedIds, getTopic, listStories } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { alternatesFor } from "@/lib/seo";

export const metadata = { alternates: alternatesFor("/") };

const PAGE_SIZE = 10;

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "for-you";
  const page = Math.max(1, Number(sp.page) || 1);
  const me = await getCurrentUser();
  const topic = tab !== "for-you" && tab !== "following" ? await getTopic(tab) : null;

  const stories =
    tab === "following"
      ? me
        ? await listStories({ followingOf: me.id, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE })
        : []
      : await listStories({
          topicSlug: tab === "for-you" ? undefined : tab,
          personalFor: tab === "for-you" ? me?.id : undefined,
          viewerId: me?.id,
          limit: PAGE_SIZE + 1,
          offset: (page - 1) * PAGE_SIZE,
        });
  const hasMore = stories.length > PAGE_SIZE;
  const shown = stories.slice(0, PAGE_SIZE);
  const saved = await bookmarkedIds(me?.id, shown.map((s) => s.id));


  return (
    <div className="mx-auto grid max-w-page grid-cols-1 lg:grid-cols-[minmax(0,1fr)_368px]">
      <main className="mx-auto w-full max-w-feed px-4 pb-16 sm:px-6 lg:max-w-none lg:border-r lg:border-line lg:px-16">
        {topic ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-6 pt-10">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{topic.name}</h1>
              {topic.description ? <p className="mt-1 text-sm text-muted">{topic.description}</p> : null}
            </div>
            <Link href={`/tag/${topic.slug}`} className="text-sm text-accent hover:underline">
              Topic page
            </Link>
          </div>
        ) : (
          <h1 className="sr-only">{tab === "following" ? "Stories from writers you follow" : "Stories for you"}</h1>
        )}
        <div className={topic ? "" : "pt-4"} />
        {shown.length ? (
          <>
            <StoryList stories={shown} savedIds={saved} signedIn={!!me} />
            <Pager page={page} hasMore={hasMore} base={tab === "for-you" ? "/?" : `/?tab=${tab}&`} />
          </>
        ) : (
          <div className="py-12">
            {tab === "following" ? (
              <EmptyState
                title="No stories from people you follow yet"
                action={<ButtonLink href="/" variant="outline">Find writers to follow</ButtonLink>}
              >
                Follow writers and their new stories will show up here.
              </EmptyState>
            ) : (
              <EmptyState title="No stories here yet" action={<ButtonLink href="/write" variant="accent">Write the first one</ButtonLink>}>
                Be the first to publish a story{tab !== "for-you" ? " on this topic" : ""}.
              </EmptyState>
            )}
          </div>
        )}
      </main>
      <aside className="hidden px-10 py-10 lg:block">
        <Sidebar />
      </aside>
    </div>
  );
}
