import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StoryList } from "@/components/blog/story-card";
import { listBookmarks } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Reading list" };

export default async function ReadingListPage() {
  const me = await requireUser("/reading-list");
  const stories = await listBookmarks(me.id);
  return (
    <main className="mx-auto max-w-feed px-4 pb-16 pt-12 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">Reading list</h1>
      <p className="mt-2 text-muted">
        {stories.length} saved {stories.length === 1 ? "story" : "stories"}
      </p>
      <div className="mt-6 border-t border-line">
        {stories.length ? (
          <StoryList stories={stories} savedIds={new Set(stories.map((s) => s.id))} signedIn />
        ) : (
          <div className="py-12">
            <EmptyState title="Nothing saved yet" action={<ButtonLink href="/" variant="outline">Browse stories</ButtonLink>}>
              Tap the bookmark icon on any story to save it here for later.
            </EmptyState>
          </div>
        )}
      </div>
    </main>
  );
}
