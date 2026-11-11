import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/tabs";
import { Sidebar } from "@/components/blog/sidebar";
import { StoryList } from "@/components/blog/story-card";
import { Pager } from "@/components/blog/pager";
import { bookmarkedIds, listStories, listTopics } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

const PAGE_SIZE = 10;

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "for-you";
  const page = Math.max(1, Number(sp.page) || 1);
  const me = await getCurrentUser();
  const topics = await listTopics(5);

  const stories =
    tab === "following"
      ? me
        ? await listStories({ followingOf: me.id, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE })
        : []
      : await listStories({
          topicSlug: tab === "for-you" ? undefined : tab,
          limit: PAGE_SIZE + 1,
          offset: (page - 1) * PAGE_SIZE,
        });
  const hasMore = stories.length > PAGE_SIZE;
  const shown = stories.slice(0, PAGE_SIZE);
  const saved = await bookmarkedIds(me?.id, shown.map((s) => s.id));

  const tabs = [
    { key: "for-you", label: "For you", href: "/" },
    ...(me ? [{ key: "following", label: "Following", href: "/?tab=following" }] : []),
    ...topics.map((t) => ({ key: t.slug, label: t.name, href: `/?tab=${t.slug}` })),
  ];

  return (
    <div className="mx-auto grid max-w-page grid-cols-1 lg:grid-cols-[minmax(0,1fr)_368px]">
      <main className="mx-auto w-full max-w-feed px-4 pb-16 sm:px-6 lg:max-w-none lg:border-r lg:border-line lg:px-16">
        <LinkTabs items={tabs} active={tab} className="sticky top-[57px] z-10 bg-bg pt-10" />
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
