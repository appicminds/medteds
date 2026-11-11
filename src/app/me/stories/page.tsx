import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/tabs";
import { StoryRowActions } from "@/components/cms/story-row-actions";
import { purgeOldTrash, TRASH_DAYS } from "@/lib/maintenance";
import { listMyStories, myStoryCounts, type MyStoriesTab } from "@/lib/queries";
import { requireCan } from "@/lib/session";
import { can } from "@/lib/permissions";
import { compactNumber, formatDate } from "@/lib/utils";

export const metadata = { title: "Your stories" };

const STATUS_LABEL: Record<string, { label: string; tone: "warning" | "accent" | "neutral" }> = {
  pending: { label: "Pending review", tone: "warning" },
  scheduled: { label: "Scheduled", tone: "accent" },
};

export default async function MyStoriesPage({ searchParams }: PageProps<"/me/stories">) {
  const me = await requireCan("write", "/me/stories");
  const raw = (await searchParams).tab;
  const tab: MyStoriesTab = raw === "published" || raw === "trash" ? raw : "drafts";
  if (tab === "trash") await purgeOldTrash();
  const [list, counts] = await Promise.all([listMyStories(me.id, tab), myStoryCounts(me.id)]);
  const totalClaps = tab === "published" ? list.reduce((n, s) => n + s.clapCount, 0) : 0;

  return (
    <main className="mx-auto max-w-feed px-4 pb-16 pt-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Your stories</h1>
        <ButtonLink href="/write" variant="accent">Write a story</ButtonLink>
      </div>
      {!can(me, "publish") ? (
        <p className="mt-3 text-sm text-muted">As a Contributor, you submit stories for review and an editor publishes them.</p>
      ) : null}
      {tab === "published" && list.length ? (
        <p className="mt-3 text-sm text-muted">{compactNumber(totalClaps)} claps across your published stories</p>
      ) : null}
      <LinkTabs
        className="mt-8"
        active={tab}
        items={[
          { key: "drafts", label: `Drafts ${counts.drafts}`, href: "/me/stories" },
          { key: "published", label: `Published ${counts.published}`, href: "/me/stories?tab=published" },
          { key: "trash", label: `Trash ${counts.trash}`, href: "/me/stories?tab=trash" },
        ]}
      />
      {tab === "trash" && list.length ? (
        <p className="mt-4 text-sm text-muted">Stories in the trash are deleted for good after {TRASH_DAYS} days.</p>
      ) : null}
      {list.length ? (
        <ul>
          {list.map((s) => {
            const badge = STATUS_LABEL[s.status];
            const href = tab === "trash" ? undefined : tab === "drafts" || s.status === "scheduled" ? `/editor/${s.id}` : `/p/${s.slug}`;
            return (
              <li key={s.id} className="flex flex-col gap-2 border-b border-line py-6">
                <div className="flex flex-wrap items-center gap-2">
                  {href ? (
                    <Link href={href} className="text-lg font-bold hover:underline">
                      {s.title || <span className="text-muted">Untitled story</span>}
                    </Link>
                  ) : (
                    <span className="text-lg font-bold">{s.title || "Untitled story"}</span>
                  )}
                  {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
                </div>
                {s.excerpt ? <p className="line-clamp-2 font-serif text-muted">{s.excerpt}</p> : null}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                  <span>
                    {s.status === "scheduled"
                      ? `Goes live ${formatDate(s.publishedAt, { year: true })}`
                      : s.status === "published"
                        ? `Published ${formatDate(s.publishedAt)}`
                        : `Last edited ${formatDate(s.updatedAt)}`}
                  </span>
                  <span>{s.readingMinutes} min read</span>
                  {s.status === "published" ? (
                    <span className="tabular-nums">
                      {compactNumber(s.viewCount)} views · {compactNumber(s.clapCount)} claps · {s.commentCount} responses
                    </span>
                  ) : null}
                  <span className="flex-1" />
                  <StoryRowActions id={s.id} status={s.status} canPublish={can(me, "publish")} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="py-12">
          <EmptyState
            title={tab === "drafts" ? "No drafts" : tab === "published" ? "Nothing published yet" : "Trash is empty"}
            action={tab === "trash" ? undefined : <ButtonLink href="/write" variant="accent">Write a story</ButtonLink>}
          >
            {tab === "drafts"
              ? "Stories you start writing are saved here automatically."
              : tab === "published"
                ? "When a story is published or scheduled it appears here."
                : "Stories you move to the trash appear here."}
          </EmptyState>
        </div>
      )}
    </main>
  );
}
