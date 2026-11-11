import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ListOwnerControls, RemoveFromListButton, SaveListButton } from "@/components/blog/library-actions-ui";
import { StoryCard } from "@/components/blog/story-card";
import { bookmarkedIds, getList } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/list/[id]">): Promise<Metadata> {
  const me = await getCurrentUser();
  const list = await getList((await params).id, me?.id);
  if (!list) return { title: "List not found", robots: { index: false, follow: false } };
  return {
    title: `${list.name} by ${list.owner.name}`,
    description: list.description ?? `A reading list by ${list.owner.name}.`,
    robots: list.isPublic ? undefined : { index: false, follow: false },
  };
}

export default async function ListPage({ params }: PageProps<"/list/[id]">) {
  const me = await getCurrentUser();
  const list = await getList((await params).id, me?.id);
  if (!list) notFound();
  const saved = await bookmarkedIds(me?.id, list.stories.map((s) => s.id));

  return (
    <main className="mx-auto max-w-feed px-4 pb-24 pt-12 sm:px-6">
      <Link href={`/@${list.owner.username}`} className="flex items-center gap-2 text-sm">
        <Avatar name={list.owner.name} src={list.owner.image} size="sm" /> {list.owner.name}
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{list.name}</h1>
      {list.description ? <p className="mt-2 text-muted">{list.description}</p> : null}
      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
        {list.count} {list.count === 1 ? "story" : "stories"}
        {!list.isPublic ? (
          <>
            · <Lock size={13} aria-hidden /> Private
          </>
        ) : null}
      </p>
      {list.isOwner ? (
        <ListOwnerControls list={{ id: list.id, name: list.name, description: list.description, isPublic: list.isPublic }} />
      ) : (
        <div className="mt-5">
          <SaveListButton listId={list.id} saved={list.saved} signedIn={!!me} />
        </div>
      )}
      <div className="mt-8 border-t border-line">
        {list.stories.length ? (
          list.stories.map((s) => (
            <div key={s.id}>
              <StoryCard story={s} saved={saved.has(s.id)} signedIn={!!me} />
              {list.isOwner ? (
                <div className="-mt-4 mb-4 flex justify-end">
                  <RemoveFromListButton listId={list.id} postId={s.id} title={s.title} />
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="py-12">
            <EmptyState title="This list is empty">
              {list.isOwner ? "Use the bookmark icon on any story to add it here." : "Nothing has been added yet."}
            </EmptyState>
          </div>
        )}
      </div>
    </main>
  );
}
