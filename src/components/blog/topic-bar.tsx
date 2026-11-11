import { Suspense } from "react";
import { TopicBarNav, type TopicBarItem } from "@/components/blog/topic-bar-nav";
import { followedTopics, listTopics, mutedBy } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

/** Scrolling row of topics under the header: followed topics when signed in, popular ones otherwise. */
export async function TopicBar() {
  const me = await getCurrentUser();
  const [followed, muted] = await Promise.all([followedTopics(me?.id), mutedBy(me?.id)]);
  const topics = (followed.length ? followed : (await listTopics(20)).map((t) => ({ id: t.id, slug: t.slug, name: t.name })))
    .filter((t) => !muted.topics.has(t.id))
    .slice(0, followed.length ? undefined : 14);
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
