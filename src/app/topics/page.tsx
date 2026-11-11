import Link from "next/link";
import { FollowTopicButton } from "@/components/blog/follow-topic-button";
import { listTopics, topicFollowInfo } from "@/lib/queries";
import { alternatesFor } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Explore topics", alternates: alternatesFor("/topics") };

export default async function TopicsPage() {
  const me = await getCurrentUser();
  const [topics, info] = await Promise.all([listTopics(), topicFollowInfo(me?.id)]);
  const following = topics.filter((t) => info.get(t.id)?.following).length;
  return (
    <main className="mx-auto max-w-feed px-4 pb-16 pt-12 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">Explore topics</h1>
      <p className="mt-3 text-muted">
        Follow the topics you care about. They appear in the bar at the top and shape your &ldquo;For you&rdquo; feed.
        {me && following ? ` You follow ${following}.` : ""}
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {topics.map((t) => {
          const fi = info.get(t.id) ?? { followers: 0, following: false };
          return (
            <li key={t.id} className="flex h-full flex-col gap-1 rounded-md border border-line p-5">
              <Link href={`/tag/${t.slug}`} className="font-semibold hover:underline">
                {t.name}
              </Link>
              {t.description ? <span className="text-sm text-muted">{t.description}</span> : null}
              <span className="mt-auto flex items-center justify-between gap-3 pt-3">
                <span className="text-xs text-muted">
                  {t.storyCount} {t.storyCount === 1 ? "story" : "stories"} · {fi.followers} {fi.followers === 1 ? "follower" : "followers"}
                </span>
                <FollowTopicButton topicId={t.id} topicName={t.name} following={fi.following} signedIn={!!me} />
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
