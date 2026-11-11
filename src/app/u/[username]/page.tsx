import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FollowButton } from "@/components/blog/follow-button";
import { StoryList } from "@/components/blog/story-card";
import { bookmarkedIds, getProfile, listStories } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { compactNumber, formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const p = await getProfile(decodeURIComponent(username));
  return p ? { title: `${p.name} (@${p.username})`, description: p.bio ?? undefined } : { title: "Writer not found" };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const me = await getCurrentUser();
  const profile = await getProfile(decodeURIComponent(username), me?.id);
  if (!profile) notFound();
  const stories = await listStories({ authorId: profile.id, limit: 50 });
  const saved = await bookmarkedIds(me?.id, stories.map((s) => s.id));
  const isMe = me?.id === profile.id;

  return (
    <div className="mx-auto grid max-w-page grid-cols-1 lg:grid-cols-[minmax(0,1fr)_368px]">
      <main className="mx-auto w-full max-w-feed px-4 pb-16 pt-10 sm:px-6 lg:max-w-none lg:border-r lg:border-line lg:px-16 lg:pt-14">
        <div className="flex items-center gap-4 lg:hidden">
          <Avatar name={profile.name} src={profile.image} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{profile.name}</h1>
            <p className="text-sm text-muted">{compactNumber(profile.followers)} followers</p>
          </div>
        </div>
        <h1 className="hidden text-4xl font-bold tracking-tight lg:block">{profile.name}</h1>
        <div className="mt-8 border-b border-line pb-4 text-sm">Stories ({stories.length})</div>
        {stories.length ? (
          <StoryList stories={stories} savedIds={saved} signedIn={!!me} />
        ) : (
          <div className="py-10">
            <EmptyState
              title={isMe ? "You haven't published anything yet" : `${profile.name} hasn't published yet`}
              action={isMe ? <ButtonLink href="/write" variant="accent">Write a story</ButtonLink> : undefined}
            />
          </div>
        )}
      </main>
      <aside className="order-first px-4 pt-6 sm:px-6 lg:order-none lg:px-10 lg:py-14">
        <div className="flex flex-col gap-4 lg:sticky lg:top-[97px]">
          <div className="hidden lg:block">
            <Avatar name={profile.name} src={profile.image} size="xl" />
            <h2 className="mt-4 font-semibold">{profile.name}</h2>
            <p className="text-sm text-muted">@{profile.username}</p>
            <p className="mt-1 text-sm text-muted">
              {compactNumber(profile.followers)} followers · {compactNumber(profile.following)} following
            </p>
          </div>
          {profile.bio ? <p className="text-sm leading-5">{profile.bio}</p> : null}
          <p className="text-xs text-muted">Member since {formatDate(profile.createdAt, { year: true })}</p>
          <div>
            {isMe ? (
              <ButtonLink href="/settings" variant="outline" size="sm">
                Edit profile
              </ButtonLink>
            ) : (
              <FollowButton userId={profile.id} following={profile.viewerFollows} signedIn={!!me} />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
