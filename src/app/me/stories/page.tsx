import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/tabs";
import { StoryRowActions } from "@/components/cms/story-row-actions";
import { listMyStories } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { compactNumber, formatDate } from "@/lib/utils";

export const metadata = { title: "Your stories" };

export default async function MyStoriesPage({ searchParams }: PageProps<"/me/stories">) {
  const me = await requireUser("/me/stories");
  const tab = (await searchParams).tab === "published" ? "published" : "drafts";
  const [drafts, published] = await Promise.all([listMyStories(me.id, "draft"), listMyStories(me.id, "published")]);
  const list = tab === "drafts" ? drafts : published;
  const totalClaps = published.reduce((n, s) => n + s.clapCount, 0);

  return (
    <main className="mx-auto max-w-feed px-4 pb-16 pt-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Your stories</h1>
        <ButtonLink href="/write" variant="accent">Write a story</ButtonLink>
      </div>
      {published.length ? (
        <p className="mt-3 text-sm text-muted">
          {published.length} published · {compactNumber(totalClaps)} claps in total
        </p>
      ) : null}
      <LinkTabs
        className="mt-8"
        active={tab}
        items={[
          { key: "drafts", label: `Drafts ${drafts.length}`, href: "/me/stories" },
          { key: "published", label: `Published ${published.length}`, href: "/me/stories?tab=published" },
        ]}
      />
      {list.length ? (
        <ul>
          {list.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 border-b border-line py-6">
              <Link href={tab === "drafts" ? `/editor/${s.id}` : `/p/${s.slug}`} className="text-lg font-bold hover:underline">
                {s.title || <span className="text-muted">Untitled story</span>}
              </Link>
              {s.excerpt ? <p className="line-clamp-2 font-serif text-muted">{s.excerpt}</p> : null}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                <span>
                  {tab === "drafts"
                    ? `Last edited ${formatDate(s.updatedAt)}`
                    : `Published ${formatDate(s.publishedAt)}`}
                </span>
                <span>{s.readingMinutes} min read</span>
                {tab === "published" ? (
                  <span className="tabular-nums">
                    {compactNumber(s.clapCount)} claps · {s.commentCount} responses
                  </span>
                ) : null}
                <span className="flex-1" />
                <StoryRowActions id={s.id} published={tab === "published"} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-12">
          <EmptyState
            title={tab === "drafts" ? "No drafts" : "Nothing published yet"}
            action={<ButtonLink href="/write" variant="accent">Write a story</ButtonLink>}
          >
            {tab === "drafts" ? "Stories you start writing are saved here automatically." : "When you publish a story it appears here."}
          </EmptyState>
        </div>
      )}
    </main>
  );
}
