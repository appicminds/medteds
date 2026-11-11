import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/tabs";
import { ListCard } from "@/components/blog/list-card";
import { ClearHistoryButton, NewListButton, RemoveHighlightButton } from "@/components/blog/library-actions-ui";
import { StoryList } from "@/components/blog/story-card";
import { bookmarkedIds, myHighlights, myHistory, myLists, savedLists } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Your library", robots: { index: false, follow: false } };

const TABS = [
  { key: "lists", label: "Your lists" },
  { key: "saved", label: "Saved lists" },
  { key: "highlights", label: "Highlights" },
  { key: "history", label: "Reading history" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const me = await requireUser("/library");
  const raw = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : "lists";

  return (
    <main className="mx-auto max-w-feed px-4 pb-24 pt-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Your library</h1>
        {tab === "lists" ? <NewListButton /> : null}
      </div>
      <LinkTabs className="mb-8 mt-8" active={tab} items={TABS.map((t) => ({ key: t.key, label: t.label, href: t.key === "lists" ? "/library" : `/library?tab=${t.key}` }))} />
      {tab === "lists" ? <ListsTab userId={me.id} /> : tab === "saved" ? <SavedTab userId={me.id} /> : tab === "highlights" ? <HighlightsTab userId={me.id} /> : <HistoryTab userId={me.id} />}
    </main>
  );
}

async function ListsTab({ userId }: { userId: string }) {
  const { own, reading } = await myLists(userId);
  return (
    <div className="flex flex-col gap-4">
      <ListCard href="/reading-list" name="Reading list" count={reading.count} covers={reading.covers} isPublic={false} />
      {own.map((l) => (
        <ListCard key={l.id} href={`/list/${l.id}`} name={l.name} description={l.description} count={l.count} covers={l.covers} isPublic={l.isPublic} />
      ))}
      {!own.length ? <p className="text-sm text-muted">Make lists to group stories by theme, like &ldquo;Cardiology basics&rdquo; or &ldquo;Read this weekend&rdquo;.</p> : null}
    </div>
  );
}

async function SavedTab({ userId }: { userId: string }) {
  const saved = await savedLists(userId);
  if (!saved.length)
    return (
      <EmptyState title="No saved lists yet">
        When you find a public list you like on someone&apos;s profile, choose &ldquo;Save list&rdquo; to keep it here.
      </EmptyState>
    );
  return (
    <div className="flex flex-col gap-4">
      {saved.map((l) => (
        <ListCard key={l.id} href={`/list/${l.id}`} name={l.name} description={l.description} count={l.count} covers={l.covers} isPublic owner={l.owner} />
      ))}
    </div>
  );
}

async function HighlightsTab({ userId }: { userId: string }) {
  const items = await myHighlights(userId);
  if (!items.length)
    return (
      <EmptyState title="No highlights yet">
        Select any text in a story and choose &ldquo;Highlight&rdquo;. Your highlights are collected here.
      </EmptyState>
    );
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((h) => (
        <li key={h.id} className="py-5">
          <blockquote className="border-l-2 border-accent pl-4 font-serif text-lg leading-7">
            <mark className="bg-accent-soft text-fg">{h.text}</mark>
          </blockquote>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted">
            <Link href={`/p/${h.slug}`} className="font-medium text-fg hover:underline">{h.title}</Link>
            <span>{h.authorName}</span>
            <span>{formatDate(h.createdAt)}</span>
            <RemoveHighlightButton id={h.id} />
          </p>
        </li>
      ))}
    </ul>
  );
}

async function HistoryTab({ userId }: { userId: string }) {
  const stories = await myHistory(userId);
  if (!stories.length)
    return (
      <EmptyState title="Nothing read yet" action={<ButtonLink href="/" variant="outline">Browse stories</ButtonLink>}>
        Stories you open appear here so you can find them again.
      </EmptyState>
    );
  const saved = await bookmarkedIds(userId, stories.map((s) => s.id));
  return (
    <>
      <div className="flex justify-end">
        <ClearHistoryButton />
      </div>
      <StoryList stories={stories} savedIds={saved} signedIn />
    </>
  );
}
