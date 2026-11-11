import { Suspense } from "react";
import { TopicBarNav, type TopicBarItem } from "@/components/blog/topic-bar-nav";
import { followedTopics, listTopics } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

/** Scrolling row of topics under the header: followed topics when signed in, popular ones otherwise. */
export async function TopicBar() {
  const me = await getCurrentUser();
  const followed = await followedTopics(me?.id);
  const topics = followed.length ? followed : (await listTopics(14)).map((t) => ({ id: t.id, slug: t.slug, name: t.name }));
  const items: TopicBarItem[] = [
    { key: "for-you", label: "For you", href: "/" },
    ...(me ? [{ key: "following", label: "Following", href: "/?tab=following" }] : []),
    ...topics.map((t) => ({ key: t.slug, label: t.name, href: `/?tab=${t.slug}` })),
  ];
  return (
    <Suspense fallback={null}>
      <TopicBarNav items={items} />
    </Suspense>
  );
}
